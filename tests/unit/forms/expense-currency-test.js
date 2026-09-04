import { run } from "@ember/runloop";
import EmberObject, { get, set } from "@ember/object";
import Service from "@ember/service";
import { resolve, reject, Promise as RSVPPromise } from "rsvp";
import { moduleFor, test } from "ember-qunit";
import ExpenseForm from "splittypie/forms/expense";

moduleFor("service:form-factory", "Unit | Form | expense currency conversion", {
    needs: [
        "model:transaction",
        "model:event",
        "model:user",
        "model:currency",
        "service:locale",
        "service:local-storage",
        "validator:presence",
        "validator:number",
        "validator:length",
        "validator:messages",
    ],
    beforeEach() {
        this.register("forms:expense", ExpenseForm, { instantiate: false });
    },
});

function createEventWithUsers(store) {
    const usd = store.createRecord("currency", { id: "USD", name: "United States dollar" });
    const eur = store.createRecord("currency", { id: "EUR", name: "Euro" });
    const event = store.createRecord("event", { name: "Trip", currency: eur });
    const bob = store.createRecord("user", { id: "bob", name: "Bob", event });
    const alice = store.createRecord("user", { id: "alice", name: "Alice", event });

    return {
        usd, eur, event, bob, alice,
    };
}

test("saving in a foreign currency converts amounts using the exchange rate, and keeps the originals", function (assert) {
    const store = this.container.lookup("service:store");
    const formFactory = this.subject();
    let transaction;

    run(() => {
        const { usd, event, bob, alice } = createEventWithUsers(store);

        transaction = store.createRecord("transaction", {
            event,
            payer: bob,
            participants: [bob, alice],
            type: "expense",
        });

        const form = formFactory.createForm("expense", transaction);

        set(form, "name", "Souvenir");
        set(form, "date", "2024-01-01");
        get(form, "_amounts").objectAt(0).value = 20;

        // bypass the async rate-fetch triggered by the transactionCurrency
        // setter - that wiring is covered separately, this only checks the
        // conversion math once a currency+rate are in place
        set(form, "_currency", usd);
        set(form, "exchangeRate", 0.5);

        form.updateModelAttributes();
    });

    assert.equal(get(transaction, "amount"), 10, "amount is converted (20 USD * 0.5 = 10 EUR)");
    assert.deepEqual(get(transaction, "amounts"), [10]);
    assert.deepEqual(get(transaction, "originalAmounts"), [20], "the originally typed-in amount is preserved");
    assert.equal(get(transaction, "currency.id"), "USD");
    assert.equal(get(transaction, "exchangeRate"), 0.5);
});

test("saving a deposit in a foreign currency converts each person's contribution", function (assert) {
    const store = this.container.lookup("service:store");
    const formFactory = this.subject();
    let transaction;
    let bob;
    let alice;

    run(() => {
        const created = createEventWithUsers(store);
        bob = created.bob;
        alice = created.alice;

        transaction = store.createRecord("transaction", {
            event: created.event,
            type: "deposit",
        });

        const form = formFactory.createForm("expense", transaction);

        set(form, "name", "Flat prepayment");
        set(form, "date", "2024-01-01");
        get(form, "contributionEntries").findBy("user", bob).set("amount", 100);
        get(form, "contributionEntries").findBy("user", alice).set("amount", 50);

        set(form, "_currency", created.usd);
        set(form, "exchangeRate", 0.5);

        form.updateModelAttributes();
    });

    const contributions = get(transaction, "contributions");
    const originalContributions = get(transaction, "originalContributions");

    assert.equal(contributions[get(bob, "id")], 50, "bob's contribution is converted (100 USD * 0.5)");
    assert.equal(contributions[get(alice, "id")], 25, "alice's contribution is converted (50 USD * 0.5)");
    assert.equal(originalContributions[get(bob, "id")], 100, "bob's original contribution is preserved");
    assert.equal(originalContributions[get(alice, "id")], 50, "alice's original contribution is preserved");
    assert.equal(get(transaction, "amount"), 75, "total amount is also converted (150 USD * 0.5)");
});

test("saving in the event's own currency doesn't convert anything", function (assert) {
    const store = this.container.lookup("service:store");
    const formFactory = this.subject();
    let transaction;

    run(() => {
        const { event, bob, alice } = createEventWithUsers(store);

        transaction = store.createRecord("transaction", {
            event,
            payer: bob,
            participants: [bob, alice],
            type: "expense",
        });

        const form = formFactory.createForm("expense", transaction);

        set(form, "name", "Dinner");
        set(form, "date", "2024-01-01");
        get(form, "_amounts").objectAt(0).value = 40;

        assert.equal(get(form, "transactionCurrency.id"), "EUR", "defaults to the event's own currency");
        assert.notOk(get(form, "isForeignCurrency"));

        form.updateModelAttributes();
    });

    assert.equal(get(transaction, "amount"), 40);
    assert.deepEqual(get(transaction, "amounts"), [40]);
    assert.deepEqual(get(transaction, "originalAmounts"), []);
    assert.equal(get(transaction, "currency.id"), null);
    assert.equal(get(transaction, "exchangeRate"), 1);
});

test("editing an existing foreign-currency transaction shows the original amount, not the converted one", function (assert) {
    const store = this.container.lookup("service:store");
    const formFactory = this.subject();

    run(() => {
        const { usd, event, bob, alice } = createEventWithUsers(store);

        const transaction = store.createRecord("transaction", {
            event,
            payer: bob,
            participants: [bob, alice],
            type: "expense",
            currency: usd,
            exchangeRate: 0.5,
            amount: 10,
            amounts: [10],
            originalAmounts: [20],
        });

        const form = formFactory.createForm("expense", transaction);

        assert.equal(get(form, "amountEntries.firstObject.value"), 20, "shows the original 20 USD, not the converted 10 EUR");
        assert.equal(get(form, "exchangeRate"), 0.5);
        assert.equal(get(form, "transactionCurrency.id"), "USD");
        assert.ok(get(form, "isForeignCurrency"));
    });
});

// regression test: a brand new transaction (as created by
// event/transactions/new.js's route model) is a plain EmberObject, not an
// ember-data record - its "currency" is genuinely undefined, not a
// PromiseObject wrapping null like a real record's unset async belongsTo
// would be. transactionCurrency's getter used to call get() on that
// undefined value, which throws and silently aborted the rest of the
// transaction-form's render (see the "everyone selected by default"
// acceptance test failure this was caught by)
test("a brand new transaction's plain object model doesn't crash currency handling", function (assert) {
    const store = this.container.lookup("service:store");
    const formFactory = this.subject();
    let form;

    run(() => {
        const { event, bob, alice } = createEventWithUsers(store);

        const model = EmberObject.create({
            event,
            payer: bob,
            participants: [bob, alice],
            type: "expense",
        });

        form = formFactory.createForm("expense", model);
    });

    assert.equal(get(form, "transactionCurrency.id"), "EUR", "falls back to the event's currency");
    assert.notOk(get(form, "isForeignCurrency"));
    assert.equal(get(form, "exchangeRate"), 1);
});

test("switching back to the event's own currency resets the exchange rate", function (assert) {
    const store = this.container.lookup("service:store");
    const formFactory = this.subject();
    let form;
    let eventCurrency;

    run(() => {
        const { usd, eur, event, bob, alice } = createEventWithUsers(store);
        eventCurrency = eur;

        const transaction = store.createRecord("transaction", {
            event,
            payer: bob,
            participants: [bob, alice],
            type: "expense",
            currency: usd,
            exchangeRate: 0.5,
        });

        form = formFactory.createForm("expense", transaction);
        set(form, "rateFetchFailed", true);
    });

    run(() => {
        set(form, "transactionCurrency", eventCurrency);
    });

    assert.notOk(get(form, "isForeignCurrency"));
    assert.equal(get(form, "exchangeRate"), 1);
    assert.notOk(get(form, "rateFetchFailed"));
});

test("picking a foreign currency starts fetching its exchange rate immediately", function (assert) {
    // a stub that never resolves during the test - we only care that
    // isFetchingRate flips synchronously as soon as the currency is set
    this.register("service:ajax", Service.extend({
        request() {
            return new RSVPPromise(() => {});
        },
    }));

    const store = this.container.lookup("service:store");
    const formFactory = this.subject();
    let form;
    let usd;

    run(() => {
        const created = createEventWithUsers(store);
        usd = created.usd;

        const transaction = store.createRecord("transaction", {
            event: created.event,
            payer: created.bob,
            participants: [created.bob, created.alice],
            type: "expense",
        });

        form = formFactory.createForm("expense", transaction);
    });

    assert.notOk(get(form, "isFetchingRate"), "not fetching before a foreign currency is picked");

    run(() => {
        set(form, "transactionCurrency", usd);
    });

    assert.ok(get(form, "isFetchingRate"), "starts fetching as soon as the currency is picked");
});

test("refreshExchangeRate resolves with the fetched rate and updates state", function (assert) {
    assert.expect(4);
    const done = assert.async();

    this.register("service:ajax", Service.extend({
        request(url) {
            assert.equal(url, "https://api.frankfurter.dev/v1/latest?from=USD&to=EUR");

            return resolve({ rates: { EUR: 0.86 } });
        },
    }));

    const store = this.container.lookup("service:store");
    const formFactory = this.subject();
    let form;

    run(() => {
        const { usd, event, bob, alice } = createEventWithUsers(store);

        const transaction = store.createRecord("transaction", {
            event,
            payer: bob,
            participants: [bob, alice],
            type: "expense",
        });

        form = formFactory.createForm("expense", transaction);
        // seed the currency directly, bypassing the setter's own fetch, so
        // this test triggers exactly one fetch via refreshExchangeRate()
        set(form, "_currency", usd);
    });

    assert.ok(get(form, "isForeignCurrency"));

    form.refreshExchangeRate().then(() => {
        run(() => {
            assert.equal(get(form, "exchangeRate"), 0.86);
            assert.notOk(get(form, "isFetchingRate"));
            done();
        });
    });
});

test("a failed exchange rate fetch is reported without crashing", function (assert) {
    const done = assert.async();

    this.register("service:ajax", Service.extend({
        request() {
            return reject(new Error("network error"));
        },
    }));

    const store = this.container.lookup("service:store");
    const formFactory = this.subject();
    let form;

    run(() => {
        const { usd, event, bob, alice } = createEventWithUsers(store);

        const transaction = store.createRecord("transaction", {
            event,
            payer: bob,
            participants: [bob, alice],
            type: "expense",
        });

        form = formFactory.createForm("expense", transaction);
        set(form, "_currency", usd);
    });

    form.refreshExchangeRate().then(() => {
        run(() => {
            assert.ok(get(form, "rateFetchFailed"));
            assert.notOk(get(form, "isFetchingRate"));
            done();
        });
    });
});

test("saving an itemized expense in a foreign currency converts each person's exact share", function (assert) {
    const store = this.container.lookup("service:store");
    const formFactory = this.subject();
    let transaction;
    let alice;
    let bob;

    run(() => {
        const created = createEventWithUsers(store);
        alice = created.alice;
        bob = created.bob;

        transaction = store.createRecord("transaction", {
            event: created.event,
            payer: alice,
            type: "itemized",
        });

        const form = formFactory.createForm("expense", transaction);

        set(form, "name", "Groceries");
        set(form, "date", "2024-01-01");
        get(form, "contributionEntries").findBy("user", bob).set("amount", 30);

        set(form, "_currency", created.usd);
        set(form, "exchangeRate", 0.5);

        form.updateModelAttributes();
    });

    assert.equal(get(transaction, "payer.id"), "alice", "the payer is preserved for an itemized expense");
    assert.equal(get(transaction, "contributions")[get(bob, "id")], 15, "bob's share is converted (30 USD * 0.5)");
    assert.equal(get(transaction, "originalContributions")[get(bob, "id")], 30);
    assert.equal(get(transaction, "amount"), 15);
});
