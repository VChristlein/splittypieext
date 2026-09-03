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
        bob = this.subject({ id: "bob" });
        family = store.createRecord("user", {
            id: "family",
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

test("a deposit credits each person exactly what they individually put in", function (assert) {
    const store = this.store();
    let alice;
    let bob;
    let carol;

    run(() => {
        const event = store.createRecord("event", {
            name: "Test event",
        });
        alice = this.subject({ id: "alice" });
        bob = store.createRecord("user", {
            id: "bob",
            name: "Bob",
            event,
        });
        carol = store.createRecord("user", {
            id: "carol",
            name: "Carol",
            event,
        });
        // everyone already deposited their own (uneven) share towards the
        // flat's prepayment - nothing here gets split any way
        const deposit = store.createRecord("transaction", {
            type: "deposit",
            name: "Flat prepayment",
            contributions: {
                [alice.get("id")]: 200,
                [bob.get("id")]: 50,
                [carol.get("id")]: 100,
            },
        });

        alice.set("event", event);
        event.get("transactions").pushObject(deposit);
    });

    assert.equal(alice.get("balance"), (200).toFixed(2));
    assert.equal(bob.get("balance"), (50).toFixed(2));
    assert.equal(carol.get("balance"), (100).toFixed(2));
});

test("a deposit doesn't credit someone who didn't contribute", function (assert) {
    const store = this.store();
    let alice;
    let bob;

    run(() => {
        const event = store.createRecord("event", {
            name: "Test event",
        });
        alice = this.subject({ id: "alice" });
        bob = store.createRecord("user", {
            id: "bob",
            name: "Bob",
            event,
        });
        const deposit = store.createRecord("transaction", {
            type: "deposit",
            name: "Flat prepayment",
            contributions: {
                [bob.get("id")]: 50,
            },
        });

        alice.set("event", event);
        event.get("transactions").pushObject(deposit);
    });

    assert.equal(bob.get("balance"), (50).toFixed(2));
    assert.equal(alice.get("balance"), (0).toFixed(2));
});

test("an itemized expense debits each person the exact amount assigned to them", function (assert) {
    const store = this.store();
    let alice;
    let bob;
    let carol;

    run(() => {
        const event = store.createRecord("event", {
            name: "Test event",
        });
        alice = this.subject({ id: "alice" });
        bob = store.createRecord("user", {
            id: "bob",
            name: "Bob",
            event,
        });
        carol = store.createRecord("user", {
            id: "carol",
            name: "Carol",
            event,
        });
        // Alice paid for groceries, but split by what each person actually
        // picked out rather than an even or weighted share
        const groceries = store.createRecord("transaction", {
            type: "itemized",
            name: "Groceries",
            amount: 45,
            payer: alice,
            contributions: {
                [bob.get("id")]: 30,
                [carol.get("id")]: 15,
            },
        });

        alice.set("event", event);
        event.get("transactions").pushObject(groceries);
    });

    assert.equal(alice.get("balance"), (45).toFixed(2));
    assert.equal(bob.get("balance"), (-30).toFixed(2));
    assert.equal(carol.get("balance"), (-15).toFixed(2));
});

test("a deposit directed at someone debits them the full amount collected", function (assert) {
    const store = this.store();
    let alice;
    let bob;
    let dave;

    run(() => {
        const event = store.createRecord("event", {
            name: "Test event",
        });
        alice = this.subject({ id: "alice" });
        bob = store.createRecord("user", {
            id: "bob",
            name: "Bob",
            event,
        });
        dave = store.createRecord("user", {
            id: "dave",
            name: "Dave",
            event,
        });
        // Alice and Bob send Dave their share of the flat's deposit so he
        // can pay the landlord with one card
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

        alice.set("event", event);
        event.get("transactions").pushObject(deposit);
    });

    assert.equal(alice.get("balance"), (100).toFixed(2));
    assert.equal(bob.get("balance"), (150).toFixed(2));
    assert.equal(dave.get("balance"), (-250).toFixed(2));
});

test("a directed deposit followed by the full expense correctly nets out who owes what", function (assert) {
    const store = this.store();
    let alice;
    let bob;
    let carol;
    let dave;
    let eve;

    run(() => {
        const event = store.createRecord("event", {
            name: "Test event",
        });
        alice = this.subject({ id: "alice" });
        bob = store.createRecord("user", { id: "bob", name: "Bob", event });
        carol = store.createRecord("user", { id: "carol", name: "Carol", event });
        dave = store.createRecord("user", { id: "dave", name: "Dave", event });
        eve = store.createRecord("user", { id: "eve", name: "Eve", event });

        // Alice and Bob prepay their share of the deposit to Dave, who's
        // booking the flat; Carol and Eve haven't paid anything yet
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

        // later, Dave pays the landlord the full $1000 (the $250 he
        // collected plus $750 of his own money), split evenly among all 5
        const flat = store.createRecord("transaction", {
            name: "Flat total cost",
            amount: 1000,
            payer: dave,
            participants: [alice, bob, carol, dave, eve],
        });

        alice.set("event", event);
        event.get("transactions").pushObjects([deposit, flat]);
    });

    // fair share = 1000 / 5 = 200 each
    assert.equal(alice.get("balance"), (100 - 200).toFixed(2));
    assert.equal(bob.get("balance"), (150 - 200).toFixed(2));
    assert.equal(carol.get("balance"), (-200).toFixed(2));
    assert.equal(eve.get("balance"), (-200).toFixed(2));
    // Dave collected 250 from others and put in 750 of his own,
    // fair share 200, so he's owed 1000 - 250 - 200 = 550 back
    assert.equal(dave.get("balance"), (-250 + 1000 - 200).toFixed(2));

    // the group's ledger should be fully conservative once every dollar
    // spent is accounted for by a transaction (no money silently created)
    const total = [alice, bob, carol, dave, eve]
        .reduce((sum, user) => sum + parseFloat(user.get("balance")), 0);

    assert.equal(total.toFixed(2), (0).toFixed(2));
});
