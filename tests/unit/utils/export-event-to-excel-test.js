import { run } from "@ember/runloop";
import { moduleForModel, test } from "ember-qunit";
import { buildWorkbook } from "splittypie/utils/export-event-to-excel";

moduleForModel("event", "Unit | Utility | export event to excel", {
    needs: ["model:user", "model:transaction", "model:currency"],
});

test("it lists each transaction with per-person factors, and formulas for the totals", function (assert) {
    const store = this.store();
    let event;

    run(() => {
        event = this.subject();
        const alice = store.createRecord("user", { id: "alice", name: "Alice", event });
        const bob = store.createRecord("user", { id: "bob", name: "Bob", factor: 0.5, event });

        event.get("users").pushObjects([alice, bob]);

        const dinner = store.createRecord("transaction", {
            name: "Dinner",
            amount: 30,
            payer: alice,
            participants: [alice, bob],
        });

        event.get("transactions").pushObject(dinner);
    });

    const sheet = buildWorkbook(event).getWorksheet("Transactions");

    assert.deepEqual(
        sheet.getRow(1).values.slice(1),
        ["Paid by", "Type", "Name", "Amount", "Alice", "Bob", "Sum of factors", "Individual amount"]
    );

    const row = sheet.getRow(2);

    assert.equal(row.getCell(1).value, "Alice");
    assert.equal(row.getCell(2).value, "Expense");
    assert.equal(row.getCell(3).value, "Dinner");
    assert.equal(row.getCell(4).value, 30);
    assert.equal(row.getCell(5).value, 1);
    assert.equal(row.getCell(6).value, 0.5);

    // sum of factors and individual amount are live formulas, not plain
    // numbers, so they keep recalculating if someone edits a factor
    assert.equal(row.getCell(7).formula, "SUM(E2:F2)");
    assert.equal(row.getCell(7).result, 1.5);
    assert.equal(row.getCell(8).formula, "D2/G2");
    assert.equal(row.getCell(8).result, 20);
});

test("it shows the amount as an addition when it was entered as several individual purchases", function (assert) {
    const store = this.store();
    let event;

    run(() => {
        event = this.subject();
        const alice = store.createRecord("user", { id: "alice", name: "Alice", event });
        const bob = store.createRecord("user", { id: "bob", name: "Bob", event });

        event.get("users").pushObjects([alice, bob]);

        const shopping = store.createRecord("transaction", {
            name: "Groceries (several trips)",
            amount: 120,
            amounts: [80, 40],
            payer: alice,
            participants: [alice, bob],
        });

        event.get("transactions").pushObject(shopping);
    });

    const amountCell = buildWorkbook(event).getWorksheet("Transactions").getRow(2).getCell(4);

    assert.equal(amountCell.formula, "80+40");
    assert.equal(amountCell.result, 120);
});

test("it shows a plain number for a transaction with just one amount", function (assert) {
    const store = this.store();
    let event;

    run(() => {
        event = this.subject();
        const alice = store.createRecord("user", { id: "alice", name: "Alice", event });

        event.get("users").pushObjects([alice]);

        const dinner = store.createRecord("transaction", {
            name: "Dinner",
            amount: 30,
            amounts: [30],
            payer: alice,
            participants: [alice],
        });

        event.get("transactions").pushObject(dinner);
    });

    const amountCell = buildWorkbook(event).getWorksheet("Transactions").getRow(2).getCell(4);

    assert.equal(amountCell.value, 30);
    assert.notOk(amountCell.formula);
});

test("it lists individual contributors and amounts for a deposit, with no factor columns", function (assert) {
    const store = this.store();
    let event;

    run(() => {
        event = this.subject();
        const alice = store.createRecord("user", { id: "alice", name: "Alice", event });
        const bob = store.createRecord("user", { id: "bob", name: "Bob", event });

        event.get("users").pushObjects([alice, bob]);

        const deposit = store.createRecord("transaction", {
            type: "deposit",
            name: "Flat prepayment",
            // in the real app this is derived from contributions by the
            // form on save, so simulate that here rather than leaving it 0
            amount: 250,
            contributions: {
                [alice.get("id")]: 200,
                [bob.get("id")]: 50,
            },
        });

        event.get("transactions").pushObject(deposit);
    });

    const row = buildWorkbook(event).getWorksheet("Transactions").getRow(2);

    assert.equal(row.getCell(1).value, "(multiple)");
    assert.equal(row.getCell(2).value, "Deposit");
    assert.equal(row.getCell(4).value, 250);
    assert.equal(row.getCell(5).value, 200);
    assert.equal(row.getCell(6).value, 50);
    assert.equal(row.getCell(7).value, null);
    assert.equal(row.getCell(8).value, null);
});

test("it shows who a deposit is directed to, and debits them the total in the balance formula", function (assert) {
    const store = this.store();
    let event;
    let alice;
    let bob;
    let dave;

    run(() => {
        event = this.subject();
        alice = store.createRecord("user", { id: "alice", name: "Alice", event });
        bob = store.createRecord("user", { id: "bob", name: "Bob", event });
        dave = store.createRecord("user", { id: "dave", name: "Dave", event });

        event.get("users").pushObjects([alice, bob, dave]);

        const deposit = store.createRecord("transaction", {
            type: "deposit",
            name: "Flat deposit",
            amount: 250,
            payer: dave,
            contributions: {
                [alice.get("id")]: 100,
                [bob.get("id")]: 150,
            },
        });

        event.get("transactions").pushObject(deposit);
    });

    const sheet = buildWorkbook(event).getWorksheet("Transactions");
    const row = sheet.getRow(2);

    // "Paid by" shows the recipient's name rather than "(multiple)" once
    // the deposit is directed at someone
    assert.equal(row.getCell(1).value, "Dave");
    assert.equal(row.getCell(2).value, "Deposit");

    // row 1: header, row 2: transaction, row 3: blank, row 4: balances
    const balanceRow = sheet.getRow(4);

    assert.equal(balanceRow.getCell(5).result, parseFloat(alice.get("balance")));
    assert.equal(balanceRow.getCell(6).result, parseFloat(bob.get("balance")));
    assert.equal(balanceRow.getCell(7).result, parseFloat(dave.get("balance")));
});

test("it lists exact per-person amounts for an itemized expense, crediting the payer", function (assert) {
    const store = this.store();
    let event;

    run(() => {
        event = this.subject();
        const alice = store.createRecord("user", { id: "alice", name: "Alice", event });
        const bob = store.createRecord("user", { id: "bob", name: "Bob", event });

        event.get("users").pushObjects([alice, bob]);

        const bill = store.createRecord("transaction", {
            type: "itemized",
            name: "Groceries",
            payer: alice,
            amount: 45,
            contributions: {
                [alice.get("id")]: 15,
                [bob.get("id")]: 30,
            },
        });

        event.get("transactions").pushObject(bill);
    });

    const row = buildWorkbook(event).getWorksheet("Transactions").getRow(2);

    assert.equal(row.getCell(1).value, "Alice");
    assert.equal(row.getCell(2).value, "Itemized");
    assert.equal(row.getCell(4).value, 45);
    assert.equal(row.getCell(5).value, 15);
    assert.equal(row.getCell(6).value, 30);
    assert.equal(row.getCell(7).value, null);
});

test("it puts every person's closing balance in one row below their column, colored and formula-driven", function (assert) {
    const store = this.store();
    let event;

    run(() => {
        event = this.subject();
        const alice = store.createRecord("user", { id: "alice", name: "Alice", event });
        const bob = store.createRecord("user", { id: "bob", name: "Bob", event });

        event.get("users").pushObjects([alice, bob]);

        const transaction = store.createRecord("transaction", {
            name: "Tickets",
            amount: 20,
            payer: alice,
            participants: [alice, bob],
        });

        event.get("transactions").pushObject(transaction);
    });

    const sheet = buildWorkbook(event).getWorksheet("Transactions");

    // row 1: header, row 2: transaction, row 3: blank, row 4: balances
    const balanceRow = sheet.getRow(4);

    assert.equal(balanceRow.getCell(1).value, "Balances");

    const aliceCell = balanceRow.getCell(5);
    const bobCell = balanceRow.getCell(6);

    assert.equal(aliceCell.result, 10);
    assert.equal(aliceCell.font.color.argb, "FF28A745");
    assert.ok(aliceCell.formula.includes("SUMPRODUCT"));

    assert.equal(bobCell.result, -10);
    assert.equal(bobCell.font.color.argb, "FFDC3545");
});

test("it computes the right balance across a mix of expense, donation, deposit and itemized rows", function (assert) {
    const store = this.store();
    let event;
    let alice;
    let bob;
    let carol;

    run(() => {
        event = this.subject();
        alice = store.createRecord("user", { id: "alice", name: "Alice", event });
        bob = store.createRecord("user", { id: "bob", name: "Bob", event });
        carol = store.createRecord("user", { id: "carol", name: "Carol", event });

        event.get("users").pushObjects([alice, bob, carol]);

        event.get("transactions").pushObjects([
            store.createRecord("transaction", {
                name: "Dinner",
                amount: 30,
                payer: alice,
                participants: [alice, bob, carol],
            }),
            store.createRecord("transaction", {
                type: "donation",
                name: "Gift",
                amount: 12,
                payer: bob,
                participants: [alice, carol],
            }),
            store.createRecord("transaction", {
                type: "deposit",
                name: "Prepayment",
                amount: 40,
                contributions: { [carol.get("id")]: 40 },
            }),
            store.createRecord("transaction", {
                type: "itemized",
                name: "Groceries",
                payer: carol,
                amount: 18,
                contributions: { [alice.get("id")]: 8, [bob.get("id")]: 10 },
            }),
        ]);
    });

    const balanceRow = buildWorkbook(event).getWorksheet("Transactions").getRow(7);

    assert.equal(balanceRow.getCell(5).result, parseFloat(alice.get("balance")));
    assert.equal(balanceRow.getCell(6).result, parseFloat(bob.get("balance")));
    assert.equal(balanceRow.getCell(7).result, parseFloat(carol.get("balance")));
});
