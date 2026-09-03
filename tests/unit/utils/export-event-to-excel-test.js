import { run } from "@ember/runloop";
import { moduleForModel, test } from "ember-qunit";
import { buildWorkbook } from "splittypie/utils/export-event-to-excel";

moduleForModel("event", "Unit | Utility | export event to excel", {
    needs: ["model:user", "model:transaction", "model:currency"],
});

test("it lists each transaction with per-person factors and totals", function (assert) {
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
    assert.deepEqual(
        sheet.getRow(2).values.slice(1),
        ["Alice", "Expense", "Dinner", 30, 1, 0.5, 1.5, 20]
    );
});

test("it colors the closing balances green or red", function (assert) {
    const store = this.store();
    let event;

    run(() => {
        event = this.subject();
        const alice = store.createRecord("user", { name: "Alice", event });
        const bob = store.createRecord("user", { name: "Bob", event });

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

    // row 1: header, row 2: transaction, row 3: blank, row 4: "Balances"
    const aliceRow = sheet.getRow(5);
    const bobRow = sheet.getRow(6);

    assert.equal(aliceRow.getCell(1).value, "Alice");
    assert.equal(aliceRow.getCell(2).value, 10);
    assert.equal(aliceRow.getCell(2).font.color.argb, "FF28A745");

    assert.equal(bobRow.getCell(1).value, "Bob");
    assert.equal(bobRow.getCell(2).value, -10);
    assert.equal(bobRow.getCell(2).font.color.argb, "FFDC3545");
});

test("it lists individual contributors and amounts for a deposit", function (assert) {
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

    const sheet = buildWorkbook(event).getWorksheet("Transactions");

    assert.deepEqual(
        sheet.getRow(2).values.slice(1),
        ["(multiple)", "Deposit", "Flat prepayment", 250, 200, 50, "", ""]
    );
});
