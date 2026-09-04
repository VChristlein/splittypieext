import { resolve, reject } from "rsvp";
import { module, test } from "qunit";
import fetchExchangeRate from "splittypie/utils/fetch-exchange-rate";

module("Unit | Utility | fetch exchange rate");

test("it resolves the rate for the requested currency pair", function (assert) {
    assert.expect(2);

    const ajax = {
        request(url) {
            assert.equal(url, "https://api.frankfurter.dev/v1/latest?from=USD&to=EUR");

            return resolve({ amount: 1, base: "USD", date: "2024-01-01", rates: { EUR: 0.86 } });
        },
    };

    return fetchExchangeRate(ajax, "USD", "EUR").then((rate) => {
        assert.equal(rate, 0.86);
    });
});

test("it rejects when the response has no rate for the requested currency", function (assert) {
    assert.expect(1);

    const ajax = {
        request() {
            return resolve({ amount: 1, base: "USD", date: "2024-01-01", rates: {} });
        },
    };

    return fetchExchangeRate(ajax, "USD", "XYZ").catch((error) => {
        assert.ok(error);
    });
});

test("it propagates a network/request failure", function (assert) {
    assert.expect(1);

    const ajax = {
        request() {
            return reject(new Error("network error"));
        },
    };

    return fetchExchangeRate(ajax, "USD", "EUR").catch((error) => {
        assert.equal(error.message, "network error");
    });
});
