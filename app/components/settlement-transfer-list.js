import { notEmpty } from "@ember/object/computed";
import EmberObject, { get, computed } from "@ember/object";
import Component from "@ember/component";

// balances/transfers are only ever meaningful to the nearest cent - treat
// anything smaller as noise (e.g. -0.00000000003, from summing unrounded
// fractional shares) so it never shows up as a phantom debt or transfer
const EPSILON = 0.005;

function convertToUserAmount(user) {
    return EmberObject.create({
        user,
        amount: Math.abs(get(user, "balance")),
    });
}

// always match the current largest debtor against the current largest
// creditor, rather than whatever order users happen to be listed in -
// favors settling the group in as few transfers as possible
function takeLargest(list) {
    return list.sortBy("amount").get("lastObject");
}

// rounding each transfer to the nearest cent independently can lose or gain
// a cent or two overall - e.g. one person's $6.67 credit collected via two
// separate $3.335 transfers would round both down to $3.33, collecting only
// $6.66. The "largest remainder method" fixes this: round every amount down
// first, then hand the few leftover cents needed to make the total exact to
// whichever transfers were closest to rounding up anyway.
function distributeRoundingRemainder(rawTransfers) {
    const cents = rawTransfers.map(t => t.rawAmount * 100);
    const floored = cents.map(Math.floor);
    const totalCents = Math.round(cents.reduce((sum, c) => sum + c, 0));
    const flooredTotal = floored.reduce((sum, c) => sum + c, 0);
    const centsToDistribute = Math.min(totalCents - flooredTotal, rawTransfers.length);

    const order = floored
        .map((_, index) => index)
        .sort((a, b) => (cents[b] - floored[b]) - (cents[a] - floored[a]));

    const finalCents = floored.slice();
    for (let i = 0; i < centsToDistribute; i += 1) {
        finalCents[order[i]] += 1;
    }

    return rawTransfers.map((t, index) => ({
        sender: t.sender,
        recipient: t.recipient,
        amount: (finalCents[index] / 100).toFixed(2),
    }));
}

export default Component.extend({
    tagName: "ul",
    classNames: ["list-unstyled"],

    anyTransfers: notEmpty("transfers"),

    transfers: computed("users.@each.balance", function () {
        const users = get(this, "users");
        const currency = get(this, "users.firstObject.event.currency");

        const owed = users.filter(u => get(u, "balance") < -EPSILON).map(convertToUserAmount);
        const paid = users.filter(u => get(u, "balance") > EPSILON).map(convertToUserAmount);
        const rawTransfers = [];

        while (owed.length > 0 && paid.length > 0) {
            const sender = takeLargest(owed);
            const recipient = takeLargest(paid);

            const canGive = get(sender, "amount");
            const demand = get(recipient, "amount");
            const possibleTransfer = Math.min(canGive, demand);

            sender.set("amount", canGive - possibleTransfer);
            if (get(sender, "amount") <= EPSILON) {
                owed.removeObject(sender);
            }

            recipient.set("amount", demand - possibleTransfer);
            if (get(recipient, "amount") <= EPSILON) {
                paid.removeObject(recipient);
            }

            rawTransfers.push({
                sender: get(sender, "user"),
                recipient: get(recipient, "user"),
                rawAmount: possibleTransfer,
            });
        }

        return distributeRoundingRemainder(rawTransfers).map(t => EmberObject.create({
            sender: t.sender,
            recipient: t.recipient,
            amount: t.amount,
            currency,
        }));
    })
});
