const POSITIVE_COLOR = { argb: "FF28A745" };
const NEGATIVE_COLOR = { argb: "FFDC3545" };

function effectiveFactor(user, transaction) {
    if (transaction.get("obeyFactors") === false) {
        return 1;
    }

    const override = parseFloat(transaction.get("participantFactors")[user.get("id")]);

    return override > 0 ? override : user.get("factorOrDefault");
}

// one row of data per transaction, independent of how it ends up laid out
// across columns - see buildTransactionValues for that part
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
            sumOfFactors: "",
            individualAmount: "",
        };
    }

    if (type === "deposit") {
        users.forEach((user) => {
            const contributed = parseFloat(transaction.get("contributions")[user.get("id")]);

            if (contributed > 0) {
                perUser[user.get("id")] = contributed;
            }
        });

        return {
            paidBy: "(multiple)",
            type: "Deposit",
            name: transaction.get("name") || "",
            amount,
            perUser,
            sumOfFactors: "",
            individualAmount: "",
        };
    }

    const participants = transaction.get("participants");
    const sumOfFactors = participants.reduce(
        (sum, p) => sum + effectiveFactor(p, transaction),
        0
    );

    participants.forEach((p) => {
        perUser[p.get("id")] = effectiveFactor(p, transaction);
    });

    return {
        paidBy: transaction.get("payer.name") || "",
        type: type === "donation" ? "Donation" : "Expense",
        name: transaction.get("name") || "",
        amount,
        perUser,
        sumOfFactors,
        individualAmount: sumOfFactors > 0 ? amount / sumOfFactors : 0,
    };
}

function buildTransactionValues(transaction, users) {
    const row = buildTransactionRow(transaction, users);
    const perUserValues = users.map((user) => {
        const value = row.perUser[user.get("id")];

        return value === undefined ? "" : value;
    });

    return [row.paidBy, row.type, row.name, row.amount]
        .concat(perUserValues)
        .concat([row.sumOfFactors, row.individualAmount]);
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

    transactions.forEach((transaction) => {
        sheet.addRow(buildTransactionValues(transaction, users));
    });

    sheet.addRow([]);
    sheet.addRow(["Balances"]).font = { bold: true };

    users.forEach((user) => {
        const balance = parseFloat(user.get("balance"));
        const row = sheet.addRow([user.get("name"), balance]);

        row.getCell(2).font = {
            bold: true,
            color: balance >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR,
        };
    });

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
