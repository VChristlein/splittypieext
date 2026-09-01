import { oneWay } from "@ember/object/computed";
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
    participants: validator("presence", true),
});

export default FormObject.extend(Validations, {
    modelName: "transaction",

    event: oneWay("model.event"),
    isSaving: oneWay("event.isSaving"),

    init() {
        this._super(...arguments);
        const model = get(this, "model");

        setProperties(
            this,
            getProperties(
                model,
                "name", "isTransfer", "date", "amount", "payer", "participants", "obeyFactors"
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
        const overrides = get(this, "_factorOverrides");
        const participantFactors = {};

        get(this, "participants").forEach((participant) => {
            participantFactors[get(participant, "id")] = overrides[get(participant, "id")];
        });

        setProperties(
            model,
            getProperties(
                this,
                "name", "date", "amount", "payer", "participants", "obeyFactors"
            )
        );
        set(model, "participantFactors", participantFactors);
    },
});
