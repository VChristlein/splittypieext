import { computed } from "@ember/object";
import Component from "@ember/component";
import { htmlSafe } from "@ember/string";

export default Component.extend({
    classNames: ["event-qr-code"],

    tagName: "div",

    svg: computed("value", function () {
        const value = this.get("value");

        if (!value) {
            return "";
        }

        const qr = window.qrcode(0, "M");

        qr.addData(value);
        qr.make();

        return htmlSafe(qr.createSvgTag({ scalable: true }));
    }),
});
