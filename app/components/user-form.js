import { or } from "@ember/object/computed";
import { inject as service } from "@ember/service";
import { get, computed } from "@ember/object";
import Component from "@ember/component";
import translate from "splittypie/utils/translate";

export default Component.extend({
    tagName: "li",
    classNames: ["user-form"],
    locale: service(),

    placeholder: computed("index", "locale.current", function () {
        const index = get(this, "index");
        const key = index === 0 ? "userForm.yourName" : "userForm.friendsName";

        return translate(get(this, "locale.current"), key);
    }),

    hasError: or("user.formErrors.name.messages", "user.formErrors.factor.messages"),

    actions: {
        delete(user) {
            this.onDelete(user);
        },
    },
});
