const POSITIVE_COLOR = { argb: "FF28A745" };
const NEGATIVE_COLOR = { argb: "FFDC3545" };

const PAID_BY_COL = 1;
const TYPE_COL = 2;
const NAME_COL = 3;
const AMOUNT_COL = 4;
const FIRST_PERSON_COL = 5;

// 1-based column index -> Excel column letters (26 -> Z, 27 -> AA, ...)
function columnLetter(index) {
    let letter = "";
    let n = index;

    while (n > 0) {
        const remainder = (n - 1) % 26;

        letter = String.fromCharCode(65 + remainder) + letter;
        n = Math.floor((n - 1) / 26);
    }

    return letter;
}

function escapeFormulaString(value) {
    return String(value).replace(/"/g, "\"\"");
}

function effectiveFactor(user, transaction) {
    if (transaction.get("obeyFactors") === false) {
        return 1;
    }

    const override = parseFloat(transaction.get("participantFactors")[user.get("id")]);

    return override > 0 ? override : user.get("factorOrDefault");
}

// one row of data per transaction, independent of how it ends up laid out
// across columns/formulas - see appendTransactionRow for that part
function buildTransactionRow(transaction, users) {
    const type = transaction.get("typeOrDefault");
    const amount = parseFloat(transaction.get("amount")) || 0;
    const perUser = {};

    if (type === "transfer") {
        const recipient = transaction.get("participants.firstObject");

        if (recipient) {
            perUser[recipient.get("id")] = amount;
        }

        return {
            paidBy: transaction.get("payer.name") || "",
            type: "Transfer",
            name: `Settled up with ${recipient ? recipient.get("name") : ""}`,
            amount,
            perUser,
            hasFactors: false,
        };
    }

    if (type === "deposit" || type === "itemized") {
        users.forEach((user) => {
            const value = parseFloat(transaction.get("contributions")[user.get("id")]);

            if (value > 0) {
                perUser[user.get("id")] = value;
            }
        });

        return {
            paidBy: type === "deposit" ? "(multiple)" : (transaction.get("payer.name") || ""),
            type: type === "deposit" ? "Deposit" : "Itemized",
            name: transaction.get("name") || "",
            amount,
            perUser,
            hasFactors: false,
        };
    }

    const participants = transaction.get("participants");

    participants.forEach((p) => {
        perUser[p.get("id")] = effectiveFactor(p, transaction);
    });

    return {
        paidBy: transaction.get("payer.name") || "",
        type: type === "donation" ? "Donation" : "Expense",
        name: transaction.get("name") || "",
        amount,
        perUser,
        hasFactors: true,
    };
}

function appendTransactionRow(sheet, transaction, users, rowNumber) {
    const row = buildTransactionRow(transaction, users);
    const sumFactorsCol = FIRST_PERSON_COL + users.get("length");
    const individualAmountCol = sumFactorsCol + 1;

    sheet.getCell(rowNumber, PAID_BY_COL).value = row.paidBy;
    sheet.getCell(rowNumber, TYPE_COL).value = row.type;
    sheet.getCell(rowNumber, NAME_COL).value = row.name;
    sheet.getCell(rowNumber, AMOUNT_COL).value = row.amount;

    users.forEach((user, index) => {
        const value = row.perUser[user.get("id")];

        sheet.getCell(rowNumber, FIRST_PERSON_COL + index).value = value === undefined
            ? null
            : value;
    });

    if (row.hasFactors) {
        const firstPersonLetter = columnLetter(FIRST_PERSON_COL);
        const lastPersonLetter = columnLetter(FIRST_PERSON_COL + users.get("length") - 1);
        const sumFactors = Object.values(row.perUser).reduce((sum, v) => sum + v, 0);

        sheet.getCell(rowNumber, sumFactorsCol).value = {
            formula: `SUM(${firstPersonLetter}${rowNumber}:${lastPersonLetter}${rowNumber})`,
            result: sumFactors,
        };
        sheet.getCell(rowNumber, individualAmountCol).value = {
            formula: `${columnLetter(AMOUNT_COL)}${rowNumber}/${columnLetter(sumFactorsCol)}${rowNumber}`,
            result: sumFactors > 0 ? row.amount / sumFactors : 0,
        };
    }
}

// one SUMPRODUCT-based formula per person, mirroring models/user.js#balance
// exactly: an expense debits participants by factor share and credits the
// payer the full amount; a donation is the same but flipped; a deposit
// credits contributors directly; an itemized expense debits the assigned
// amounts directly while still crediting the payer the full amount; a
// transfer credits the sender and debits the recipient by the flat amount
function balanceFormula(personColLetter, name, firstRow, lastRow) {
    const paidByRange = `$${columnLetter(PAID_BY_COL)}$${firstRow}:$${columnLetter(PAID_BY_COL)}$${lastRow}`;
    const typeRange = `$${columnLetter(TYPE_COL)}$${firstRow}:$${columnLetter(TYPE_COL)}$${lastRow}`;
    const amountRange = `$${columnLetter(AMOUNT_COL)}$${firstRow}:$${columnLetter(AMOUNT_COL)}$${lastRow}`;
    const personRange = `${personColLetter}$${firstRow}:${personColLetter}$${lastRow}`;
    const quotedName = `"${escapeFormulaString(name)}"`;

    const paidAs = type => `SUMPRODUCT((${paidByRange}=${quotedName})*(${typeRange}=${type})*${amountRange})`;
    const owedAs = (type, factorRange) => (
        factorRange
            ? `SUMPRODUCT((${typeRange}=${type})*${personRange}*${factorRange})`
            : `SUMPRODUCT((${typeRange}=${type})*${personRange})`
    );

    return [
        paidAs('"Expense"'),
        `-${owedAs('"Expense"', "INDIVIDUAL_AMOUNT_RANGE")}`,
        `-${paidAs('"Donation"')}`,
        `+${owedAs('"Donation"', "INDIVIDUAL_AMOUNT_RANGE")}`,
        `+${owedAs('"Deposit"')}`,
        `+${paidAs('"Itemized"')}`,
        `-${owedAs('"Itemized"')}`,
        `+${paidAs('"Transfer"')}`,
        `-${owedAs('"Transfer"')}`,
    ].join("");
}

function appendBalanceRow(sheet, users, rowNumber, firstDataRow, lastDataRow) {
    sheet.getCell(rowNumber, PAID_BY_COL).value = "Balances";
    sheet.getRow(rowNumber).font = { bold: true };

    const sumFactorsCol = FIRST_PERSON_COL + users.get("length");
    const individualAmountLetter = columnLetter(sumFactorsCol + 1);
    const individualAmountRange = lastDataRow >= firstDataRow
        ? `${individualAmountLetter}$${firstDataRow}:${individualAmountLetter}$${lastDataRow}`
        : null;

    users.forEach((user, index) => {
        const col = FIRST_PERSON_COL + index;
        const cell = sheet.getCell(rowNumber, col);
        const balance = parseFloat(user.get("balance"));

        if (lastDataRow >= firstDataRow) {
            const formula = balanceFormula(
                columnLetter(col),
                user.get("name"),
                firstDataRow,
                lastDataRow
            ).replace(/INDIVIDUAL_AMOUNT_RANGE/g, individualAmountRange);

            cell.value = { formula, result: balance };
        } else {
            cell.value = balance;
        }

        cell.numFmt = "0.00";
        cell.font = {
            bold: true,
            color: balance >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR,
        };
    });
}

function triggerDownload(buffer, filename) {
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function buildWorkbook(event) {
    const users = event.get("users");
    const transactions = event.get("transactions");

    const workbook = new window.ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transactions");

    const header = ["Paid by", "Type", "Name", "Amount"]
        .concat(users.getEach("name"))
        .concat(["Sum of factors", "Individual amount"]);

    sheet.addRow(header).font = { bold: true };

    transactions.forEach((transaction, index) => {
        appendTransactionRow(sheet, transaction, users, index + 2);
    });

    const firstDataRow = 2;
    const lastDataRow = 1 + transactions.get("length");

    // row lastDataRow + 1 is left blank as a visual separator
    appendBalanceRow(sheet, users, lastDataRow + 2, firstDataRow, lastDataRow);

    sheet.columns.forEach((column) => {
        column.width = 16;
    });

    return workbook;
}

export default function exportEventToExcel(event) {
    const workbook = buildWorkbook(event);

    return workbook.xlsx.writeBuffer().then((buffer) => {
        triggerDownload(buffer, `${event.get("name") || "splittypie"}.xlsx`);
    });
}
