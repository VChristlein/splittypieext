// looks up the current rate to convert 1 unit of `from` into `to`, e.g.
// fetchExchangeRate(ajax, "USD", "EUR") -> 0.86 (1 USD is worth 0.86 EUR)
export default function fetchExchangeRate(ajax, from, to) {
    return ajax
        .request(`https://api.frankfurter.dev/v1/latest?from=${from}&to=${to}`)
        .then((data) => {
            const rate = data && data.rates && data.rates[to];

            if (!(rate > 0)) {
                throw new Error(`No exchange rate available from ${from} to ${to}`);
            }

            return rate;
        });
}
