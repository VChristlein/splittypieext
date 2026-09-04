/*eslint-disable*/
module.exports = {
  test_page: 'tests/index.html?hidepassed',
  disable_watching: true,
  launch_in_ci: [
    'Chrome'
  ],
  launch_in_dev: [
    'Chrome'
  ],
  browser_args: {
    Chrome: {
      mode: 'ci',
      args: [
        '--disable-gpu',
        '--headless',
        '--remote-debugging-port=0',
        '--window-size=1440,900',
        // acceptance tests hit a local firebase-server emulator at this
        // host; map it to localhost so it works without an /etc/hosts entry
        '--host-resolver-rules=MAP localhost.firebaseio.test 127.0.0.1'
      ].filter(Boolean)
    }
  }
};
