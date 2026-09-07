import { equal, gt } from "@ember/object/computed";
import Component from "@ember/component";

export default Component.extend({
    tagName: "tr",
    classNames: ["user-balance-list-item"],

    isPositive: gt("user.balance", 0),
    isSettled: equal("user.balance", 0),
});
