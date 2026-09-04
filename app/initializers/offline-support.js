/* eslint-disable no-param-reassign, max-len */
import Ember from "ember";
import { get } from "@ember/object";
import translate from "splittypie/utils/translate";

const { Logger: { error, debug } } = Ember;

export default {
    name: "offline-support",
    initialize(application) {
        const notify = application.__container__.lookup("service:notify");
        const locale = application.__container__.lookup("service:locale");

        if ("serviceWorker" in window.navigator) {
            window.navigator.serviceWorker.register("/offline-support.js").then((registration) => {
                const isUpdate = !!registration.active;
                debug("Offline Support Registered", registration);

                registration.onupdatefound = function () {
                    debug("A new Service Worker version has been found...");

                    registration.installing.onstatechange = function () {
                        if (this.state === "installed") {
                            debug("Service Worker Installed.");

                            if (isUpdate) {
                                notify.info(
                                    translate(get(locale, "current"), "offline.updated"),
                                    { closeAfter: null }
                                );
                            } else {
                                notify.success(translate(get(locale, "current"), "offline.ready"));
                            }
                        } else {
                            debug("New Service Worker state: ", this.state);
                        }
                    };
                };
            }).catch((err) => {
                error(err);
            });
        }
    },
};
