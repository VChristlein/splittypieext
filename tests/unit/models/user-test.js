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
