import EmberObject from "@ember/object";
import { run } from "@ember/runloop";
import { equal } from "@ember/object/computed";
import { resolve } from "rsvp";
import { moduleFor } from "ember-qunit";
import sinonTest from "ember-sinon-qunit/test-support/test";
import sinon from "sinon";

const ConnectionMock = EmberObject.extend({
    state: "offline",
    isOnline: equal("state", "online"),
    isOffline: equal("state", "offline"),
});
const StoreMock = EmberObject.extend({
    unloadAll() {},

    findAll() {
        return resolve([]);
    },
});
const SyncQueueMock = EmberObject.extend({
    flush() {
        return resolve(true);
    },
});

moduleFor("service:syncer", "Unit | Service | syncer", {
    beforeEach() {
        this.register("service:online-store", StoreMock);
        this.register("service:store", StoreMock);
        this.register("service:connection", ConnectionMock);
        this.register("service:sync-queue", SyncQueueMock);
    },
});

sinonTest("start syncing when goes online", function (assert) {
    const service = this.subject();

    service.syncOnline = this.stub();
    service.get("connection").set("state", "online");

    assert.ok(service.syncOnline.calledOnce);
});

sinonTest("syncOnline sets isSyncing property while syncing", function (assert) {
    assert.expect(2);

    const service = this.subject();

    run(() => {
        service.syncOnline().then(() => {
            assert.notOk(service.get("isSyncing"), "after sync state");
        });
        assert.ok(service.get("isSyncing"), "is Syncing state");
    });
});

sinonTest("syncOnline runs operations: reloadOnline, flushQueue, updateOffline", function () {
    const service = this.subject();

    service._reloadOnlineStore = this.stub().returns(resolve(true));
    service._flushSyncQueue = this.stub().returns(resolve(true));
    service._updateOfflineStore = this.stub().returns(resolve(true));

    run(() => {
        service.syncOnline().then(() => {
            sinon.assert.callOrder(
                service._reloadOnlineStore,
                service._flushSyncQueue,
                service._updateOfflineStore
            );
        });
    });
});

sinonTest("pushEventOnline resolves and starts listening once the online push succeeds", function (assert) {
    assert.expect(3);

    const service = this.subject();
    const onlineEvent = EmberObject.create({ id: "online-1" });
    const offlineEvent = EmberObject.create({
        isOffline: true,
        save: this.stub().returns(resolve(offlineEvent)),
    });

    service._pushToStore = this.stub().returns(resolve(onlineEvent));
    service._listenForChanges = this.stub();

    run(() => {
        service.pushEventOnline(offlineEvent).then(() => {
            assert.notOk(offlineEvent.get("isOffline"));
            assert.ok(service._listenForChanges.calledWith(onlineEvent));
            assert.ok(offlineEvent.save.calledOnce);
        });
    });
});

sinonTest("pushEventOnline rejects instead of throwing when the online store throws synchronously", function (assert) {
    assert.expect(1);

    const service = this.subject();
    const offlineEvent = EmberObject.create({ isOffline: true });

    service._pushToStore = this.stub().throws(new Error("Cannot parse Firebase url"));

    run(() => {
        service.pushEventOnline(offlineEvent).catch((error) => {
            assert.equal(error.message, "Cannot parse Firebase url");
        });
    });
});
