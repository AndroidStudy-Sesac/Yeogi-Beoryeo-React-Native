const { withMainActivity } = require('expo/config-plugins');

/** Keep a session key in Android saved state; a fresh task gets a fresh key. */
module.exports = function withAndroidSearchSession(config) {
  return withMainActivity(config, mod => {
    if (mod.modResults.language !== 'kt') throw new Error('Search session requires a Kotlin MainActivity.');
    let source = mod.modResults.contents;
    if (source.includes('// Search session saved-state boundary')) return mod;

    const replacements = [
      ['class MainActivity : ReactActivity() {', `class MainActivity : ReactActivity() {
  // Search session saved-state boundary
  private var searchSessionId: String? = null

  override fun onSaveInstanceState(outState: Bundle) {
    super.onSaveInstanceState(outState)
    outState.putString("searchSessionId", searchSessionId)
  }`],
      ['override fun onCreate(savedInstanceState: Bundle?) {', `override fun onCreate(savedInstanceState: Bundle?) {
    searchSessionId = savedInstanceState?.getString("searchSessionId")
      ?: java.util.UUID.randomUUID().toString()`],
      ['fabricEnabled\n          ){}', `fabricEnabled
          ) {
            override fun getLaunchOptions(): Bundle = Bundle().apply {
              putString("searchSessionId", this@MainActivity.searchSessionId)
            }
          }`],
    ];
    source = source.replaceAll('\r\n', '\n');
    for (const [anchor, replacement] of replacements) {
      if (!source.includes(anchor)) throw new Error(`Unsupported MainActivity template: ${anchor}`);
      source = source.replace(anchor, replacement);
    }
    mod.modResults.contents = source;
    return mod;
  });
};
