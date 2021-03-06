/**
 * Tasks for managing configuration for the current machine.
 */
var fs = require("fs");
var deepmerge = require("deepmerge");

const CHROME_SEARCH_PATHS = [
  "/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary",
  "/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome"
];

module.exports = function(grunt) {
  var helpers = require("./helpers")(grunt);

  grunt.registerTask("config-chrome", function() {
    helpers.promptBrowser("chrome", "Chrome", CHROME_SEARCH_PATHS, this.async());
  });

  grunt.registerTask("merge-chrome-config", function() {
    var cfg = grunt.config.get("siteConfig");
    if (cfg.chromeEnabled) {
      grunt.config.merge({
        test: {
          chrome: deepmerge(grunt.config.get("browserTests"), {
            options: {
              desiredCapabilities: {
                browserName: "chrome",
                commandLineFlags: "--remote-debugging-port=9222",
                chromeOptions: {
                  binary: cfg.chromePath
                }
              }
            },
          })
        }
      });
    }
  });

  grunt.registerTask("merge-site-config", ["chrome-site-config"]);
};
