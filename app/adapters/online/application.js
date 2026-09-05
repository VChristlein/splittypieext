import { A } from "@ember/array";
import { isNone } from "@ember/utils";
import RSVP, { allSettled } from "rsvp";
import FirebaseAdapter from "emberfire/adapters/firebase";

export default FirebaseAdapter.extend({
    // emberfire@2.0.10's updateRecord() reads `recordRef.path.toString()` to
    // find the ref's last path segment (to detect whether the record's id is
    // already implied by its position in the tree). firebase@8 dropped the
    // public `.path` property from Reference - `.toString()` still returns
    // the full URL, whose last segment is identical for this purpose. This
    // is a copy of the upstream method with only that one line changed - see
    // memory/firebase_sdk_regional_url_incompatible.md for why we're on a
    // newer SDK than emberfire was written against.
    updateRecord(store, typeClass, snapshot) {
        const recordRef = this._getAbsoluteRef(snapshot.record);
        const recordCache = this._getRecordCache(typeClass, snapshot.id);
        const pathPieces = recordRef.toString().split("/");
        const lastPiece = pathPieces[pathPieces.length - 1];
        const serializedRecord = snapshot.serialize({
            includeId: (lastPiece !== snapshot.id), // record has no firebase `key` in path
        });
        const serializer = store.serializerFor(typeClass.modelName);

        return new RSVP.Promise((resolve, reject) => {
            const relationshipsToSave = [];

            snapshot.record.eachRelationship((key, relationship) => {
                const relationshipKey = serializer.keyForRelationship(key);
                const data = serializedRecord[relationshipKey];
                const isEmbedded = this.isRelationshipEmbedded(store, typeClass.modelName, relationship);
                const hasMany = relationship.kind === "hasMany";

                if (hasMany || isEmbedded) {
                    if (!isNone(data)) {
                        relationshipsToSave.push({
                            data,
                            relationship,
                            isEmbedded,
                            hasMany,
                        });
                    }
                    delete serializedRecord[relationshipKey];
                }
            });

            const reportError = (errors) => {
                const error = new Error(`Some errors were encountered while saving ${typeClass} ${snapshot.id}`);
                error.errors = errors;
                reject(error);
            };

            this._updateRecord(recordRef, serializedRecord).then(() => {
                const savedRelationships = relationshipsToSave.map((relationshipToSave) => {
                    const { data, relationship } = relationshipToSave;

                    if (relationshipToSave.hasMany) {
                        return this._saveHasManyRelationship(store, typeClass, relationship, data, recordRef, recordCache);
                    } else if (relationshipToSave.isEmbedded) {
                        return this._saveEmbeddedBelongsToRecord(store, typeClass, relationship, data, recordRef);
                    }

                    return undefined;
                });

                return allSettled(savedRelationships);
            }).catch((e) => {
                reportError([e]);
            }).then((results) => {
                const rejected = A(results).filterBy("state", "rejected");

                if (rejected.length !== 0) {
                    reportError(rejected.mapBy("reason").toArray());
                } else {
                    resolve();
                }
            });
        }, `DS: FirebaseAdapter#updateRecord ${typeClass} to ${recordRef.toString()}`);
    },
});
