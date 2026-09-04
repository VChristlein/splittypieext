import RSVP, { Promise } from "rsvp";
import { later } from "@ember/runloop";
import { get } from "@ember/object";
import Error from "@ember/error";
import Service, { inject as service } from "@ember/service";

// if the online adapter's lookup never settles at all (e.g. a hung
// connection attempt to a misconfigured database), give up after this long
// rather than leaving offline-first users stuck on a loading screen forever
const ONLINE_LOOKUP_TIMEOUT_MS = 8000;

export default Service.extend({
    store: service(),
    onlineStore: service(),
    syncer: service(),
    syncQueue: service(),

    find(id) {
        return new Promise((resolve, reject) => {
            const offlineRecord = get(this, "store")
                      .findRecord("event", id)
                      .then((event) => {
                          resolve(event);
                          return event;
                      })
                      .catch(() => false);

            // the online adapter can throw synchronously (e.g. a
            // misconfigured/unreachable Firebase database), which would
            // otherwise bypass .catch() entirely and leave this whole
            // promise permanently unsettled - offline-first only works if a
            // broken online lookup degrades to "couldn't reach it", not to
            // a hang. It can also never settle at all (a hung connection
            // attempt), so this also races it against a timeout.
            let onlineLookup;

            try {
                onlineLookup = get(this, "onlineStore").findRecord("event", id);
            } catch (error) {
                onlineLookup = RSVP.reject(error);
            }

            const onlineRecord = RSVP.race([
                onlineLookup,
                new Promise(r => later(r, false, ONLINE_LOOKUP_TIMEOUT_MS)),
            ]).catch(() => false);

            RSVP.hash({
                offlineRecord,
                onlineRecord,
            }).then(({ offlineRecord: offline, onlineRecord: online }) => {
                if (!offline && online) {
                    resolve(
                        get(this, "syncer").pushEventOffline(online)
                    );
                } else if (!online && !offline) {
                    reject(new Error("no record was found"));
                }
            });
        });
    },

    save(event) {
        const operation = get(event, "isNew") ? "createEvent" : "updateEvent";

        return event.save().then((record) => {
            const payload = record.serialize({ includeId: true });

            delete payload.transactions;

            return get(this, "syncQueue")
                .enqueue(operation, payload)
                .then(() => record);
        });
    },

    remove(event) {
        const id = get(event, "id");

        return event
            .destroyRecord()
            .then(result => get(this, "syncQueue")
                  .enqueue("destroyEvent", { id })
                  .then(() => result)
                 );
    },
});
