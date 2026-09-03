import { run } from "@ember/runloop";
import { moduleForModel, test } from "ember-qunit";

moduleForModel("user", "Unit | Model | user", {
    // Specify the other units that are required for this test.
    needs: ["model:event", "model:transaction", "model:currency"],
});

test("it exists", function (assert) {
    const model = this.subject();
    // let store = this.store();
    assert.ok(!!model);
});

test("it shows user's transactions balance", function (assert) {
    const store = this.store();
    let alice;
    let bob;

    run(() => {
        const event = store.createRecord("event", {
            name: "Test event",
        });
        alice = this.subject();
        bob = store.createRecord("user", {
            name: "Bob",
            event,
        });
        const transaction = store.createRecord("transaction", {
            name: "Alice bought a present",
            amount: 120,
            payer: alice,
            participants: [alice, bob],
        });

        alice.set("event", event);
        event.get("transactions").pushObject(transaction);
    });

    assert.equal(alice.get("balance"), 60);
    assert.equal(bob.get("balance"), -60);
});

test("it splits cost proportionally to each participant's factor", function (assert) {
    const store = this.store();
    let alice;
    let bob;
    let child;

    run(() => {
        const event = store.createRecord("event", {
            name: "Test event",
        });
        alice = this.subject();
        bob = store.createRecord("user", {
            name: "Bob",
            event,
        });
        child = store.createRecord("user", {
            name: "Child",
            factor: 0.5,
            event,
        });
        const transaction = store.createRecord("transaction", {
            name: "Dinner",
            amount: 100,
            payer: alice,
            participants: [alice, bob, child],
        });

        alice.set("event", event);
        event.get("transactions").pushObject(transaction);
    });

    // total factor = 1 (alice) + 1 (bob) + 0.5 (child) = 2.5
    assert.equal(alice.get("balance"), (100 - (100 * 1 / 2.5)).toFixed(2));
    assert.equal(bob.get("balance"), (-(100 * 1 / 2.5)).toFixed(2));
    assert.equal(child.get("balance"), (-(100 * 0.5 / 2.5)).toFixed(2));
});

test("it splits cost evenly when a transaction opts out of factors", function (assert) {
    const store = this.store();
    let alice;
    let bob;
    let child;

    run(() => {
        const event = store.createRecord("event", {
            name: "Test event",
        });
        alice = this.subject();
        bob = store.createRecord("user", {
            name: "Bob",
            event,
        });
        child = store.createRecord("user", {
            name: "Child",
            factor: 0.5,
            event,
        });
        const transaction = store.createRecord("transaction", {
            name: "Movie tickets (same price for everyone)",
            amount: 90,
            payer: alice,
            participants: [alice, bob, child],
            obeyFactors: false,
        });

        alice.set("event", event);
        event.get("transactions").pushObject(transaction);
    });

    // split evenly among 3 participants, factors ignored
    assert.equal(alice.get("balance"), (90 - (90 / 3)).toFixed(2));
    assert.equal(bob.get("balance"), (-(90 / 3)).toFixed(2));
    assert.equal(child.get("balance"), (-(90 / 3)).toFixed(2));
});

test("it lets a transaction override a participant's factor just for itself", function (assert) {
    const store = this.store();
    let bob;
    let family;

    run(() => {
        const event = store.createRecord("event", {
            name: "Test event",
        });
        bob = this.subject();
        family = store.createRecord("user", {
            name: "Family",
            factor: 3,
            event,
        });

        // dinner: everyone in the family ate, so the usual factor of 3 applies
        const dinner = store.createRecord("transaction", {
            name: "Dinner",
            amount: 100,
            payer: bob,
            participants: [bob, family],
        });

        // drinks: only 1 family member had a drink, so override their factor
        // for this transaction alone, down from their usual 3 to 1
        const drinks = store.createRecord("transaction", {
            name: "Round of drinks",
            amount: 20,
            payer: bob,
            participants: [bob, family],
            participantFactors: { [family.get("id")]: 1 },
        });

        bob.set("event", event);
        event.get("transactions").pushObjects([dinner, drinks]);
    });

    // dinner: total factor = 1 (bob) + 3 (family) = 4
    // drinks: total factor = 1 (bob) + 1 (family override) = 2
    const bobOwes = (100 * 1 / 4) + (20 * 1 / 2);
    const familyOwes = (100 * 3 / 4) + (20 * 1 / 2);

    assert.equal(bob.get("balance"), (120 - bobOwes).toFixed(2));
    assert.equal(family.get("balance"), (-familyOwes).toFixed(2));
});

test("a donation credits everyone it's split among, and debits the donor", function (assert) {
    const store = this.store();
    let alice;
    let bob;
    let carol;

    run(() => {
        const event = store.createRecord("event", {
            name: "Test event",
        });
        alice = this.subject();
        bob = store.createRecord("user", {
            name: "Bob",
            event,
        });
        carol = store.createRecord("user", {
            name: "Carol",
            event,
        });
        // Bob donates towards Alice's gift; the group buying it (Alice and
        // Carol) gets credited, Bob does not expect anything back
        const donation = store.createRecord("transaction", {
            type: "donation",
            name: "Alice's birthday gift",
            amount: 20,
            payer: bob,
            participants: [alice, carol],
        });

        alice.set("event", event);
        event.get("transactions").pushObject(donation);
    });

    assert.equal(bob.get("balance"), (-20).toFixed(2));
    assert.equal(alice.get("balance"), (10).toFixed(2));
    assert.equal(carol.get("balance"), (10).toFixed(2));
});

test("a donation credits according to weight, same as an expense would debit", function (assert) {
    const store = this.store();
    let bob;
    let child;

    run(() => {
        const event = store.createRecord("event", {
            name: "Test event",
        });
        bob = this.subject();
        child = store.createRecord("user", {
            name: "Child",
            factor: 0.5,
            event,
        });
        const another = store.createRecord("user", {
            name: "Another kid",
            factor: 0.5,
            event,
        });
        const donation = store.createRecord("transaction", {
            type: "donation",
            name: "Gift for the class",
            amount: 30,
            payer: bob,
            participants: [child, another],
        });

        bob.set("event", event);
        event.get("transactions").pushObject(donation);
    });

    // total factor = 0.5 + 0.5 = 1, so each kid gets half of the 30
    assert.equal(bob.get("balance"), (-30).toFixed(2));
    assert.equal(child.get("balance"), (15).toFixed(2));
});

test("a deposit is split among participants just like a regular expense", function (assert) {
    const store = this.store();
    let alice;
    let bob;
    let carol;

    run(() => {
        const event = store.createRecord("event", {
            name: "Test event",
        });
        alice = this.subject();
        bob = store.createRecord("user", {
            name: "Bob",
            event,
        });
        carol = store.createRecord("user", {
            name: "Carol",
            event,
        });
        // Bob fronts the flat's deposit for the whole group in one go,
        // instead of everyone depositing their share individually
        const deposit = store.createRecord("transaction", {
            type: "deposit",
            name: "Flat prepayment",
            amount: 300,
            payer: bob,
            participants: [alice, bob, carol],
        });

        alice.set("event", event);
        event.get("transactions").pushObject(deposit);
    });

    assert.equal(bob.get("balance"), (300 - (300 / 3)).toFixed(2));
    assert.equal(alice.get("balance"), (-(300 / 3)).toFixed(2));
    assert.equal(carol.get("balance"), (-(300 / 3)).toFixed(2));
});
