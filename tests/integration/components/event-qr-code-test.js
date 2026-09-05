import { moduleForComponent, test } from "ember-qunit";
import hbs from "htmlbars-inline-precompile";

moduleForComponent("event-qr-code", "Integration | Component | event qr code", {
    integration: true,
});

test("it renders a scannable QR code for the given value", function (assert) {
    this.set("value", "https://splittypie.com/some-event-id");

    this.render(hbs`{{event-qr-code value=value}}`);

    assert.equal(this.$("svg").length, 1, "renders an svg element");
    assert.ok(this.$("svg rect, svg path").length > 0, "the svg has actual QR code content, not just an empty shell");
});

test("it renders nothing when there's no value yet", function (assert) {
    this.render(hbs`{{event-qr-code value=value}}`);

    assert.equal(this.$("svg").length, 0);
});
