import { equal, not, oneWay } from "@ember/object/computed";
import EmberObject, {
  computed,
  getWithDefault,
  setProperties,
  getProperties,
  set,
  get
} from "@ember/object";
import { validator, buildValidations } from "ember-cp-validations";

import FormObject from "./form-object";

export const TRANSACTION_TYPES = [
    { value: "expense", label: "Expense" },
    { value: "donation", label: "Donation (e.g. birthday gift)" },
    { value: "deposit", label: "Deposit (e.g. prepayment)" },
];

const Validations = buildValidations({
    name: {
        validators: [
            validator("presence", true),
            validator("length", { max: 50 }),
        ],
    },
    amount: {
        validators: [
            validator("presence", true),
            validator("number", { allowString: true }),
        ],
    },
    payer: validator("presence", true),
    participants: validator("presence", {
        presence: true,
        // a donation/deposit is a one-way contribution to the pot, not
        // split among anyone, so it doesn't need any participants
        disabled: not("model.requiresParticipants"),
    }),
});

export default FormObject.extend(Validations, {
    modelName: "transaction",

    event: oneWay("model.event"),
    isSaving: oneWay("event.isSaving"),

    requiresParticipants: equal("type", "expense"),

    selectedTransactionType: computed("type", {
        get() {
            return TRANSACTION_TYPES.findBy("value", get(this, "type"));
        },
        set(key, option) {
            set(this, "type", get(option, "value"));

            return option;
        },
    }),

    payerLabel: computed("type", function () {
        return {
            donation: "Who's donating?",
            deposit: "Who's depositing?",
        }[get(this, "type")] || "Who paid?";
    }),

    init() {
        this._super(...arguments);
        const model = get(this, "model");

        setProperties(
            this,
            getProperties(
                model,
                "name", "isTransfer", "date", "amount", "payer", "participants", "obeyFactors",
                "type"
            )
        );
        set(this, "participants", getWithDefault(model, "participants", []).toArray());
        set(this, "_factorOverrides", Object.assign({}, getWithDefault(model, "participantFactors", {})));
    },

    // one editable row per selected participant, showing their usual factor
    // (or this transaction's override, if one was already set) which can be
    // tweaked just for this transaction without touching their global factor
    participantFactorEntries: computed("participants.[]", function () {
        const overrides = get(this, "_factorOverrides");

        return get(this, "participants").map((participant) => {
            const id = get(participant, "id");

            if (!(id in overrides)) {
                overrides[id] = get(participant, "factorOrDefault") || 1;
            }

            return EmberObject.extend({
                factor: computed({
                    get() {
                        return overrides[id];
                    },
                    set(key, value) {
                        overrides[id] = value;

                        return value;
                    },
                }),
            }).create({ participant });
        });
    }),

    updateModelAttributes() {
        const model = get(this, "model");
        const requiresParticipants = get(this, "requiresParticipants");
        const overrides = get(this, "_factorOverrides");
        const participantFactors = {};

        if (requiresParticipants) {
            get(this, "participants").forEach((participant) => {
                participantFactors[get(participant, "id")] = overrides[get(participant, "id")];
            });
        }

        setProperties(
            model,
            getProperties(this, "name", "date", "amount", "payer", "obeyFactors", "type")
        );
        // a donation/deposit isn't split among anyone, regardless of
        // whatever participants were picked before switching to that type
        set(model, "participants", requiresParticipants ? get(this, "participants") : []);
        set(model, "participantFactors", participantFactors);
    },
});
