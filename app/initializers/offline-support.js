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
            // whether *this* page load already had a service worker in
            // control before we even registered - if not, there's nothing
            // to update *from*, just a first install
            const hadControllerAtLoad = !!window.navigator.serviceWorker.controller;

            window.navigator.serviceWorker.register("/offline-support.js").then((registration) => {
                debug("Offline Support Registered", registration);

                if (hadControllerAtLoad) {
                    return;
                }

                registration.onupdatefound = function () {
                    debug("A new Service Worker version has been found...");

                    registration.installing.onstatechange = function () {
                        if (this.state === "installed") {
                            debug("Service Worker Installed.");
                            notify.success(translate(get(locale, "current"), "offline.ready"));
                        } else {
                            debug("New Service Worker state: ", this.state);
                        }
                    };
                };
            }).catch((err) => {
                error(err);
            });

            // fires exactly once per page lifetime, precisely when a new
            // service worker actually takes control of *this* page while
            // it's open. Unlike re-deriving "there's an update" from
            // registration/installing-worker state fresh on every page
            // load (which can spuriously re-fire the "please reload"
            // message on the very reload that already picked up the new
            // version - the previous page's update-detection state can
            // still be resolving when the next page's listeners attach),
            // this only reacts to a genuine change during this page's own
            // lifetime, so an already-current page can never see it.
            window.navigator.serviceWorker.addEventListener("controllerchange", () => {
                if (hadControllerAtLoad) {
                    notify.info(
                        translate(get(locale, "current"), "offline.updated"),
                        { closeAfter: null }
                    );
                }
            });
        }
    },
};
