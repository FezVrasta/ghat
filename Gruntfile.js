module.exports = function(grunt) {
    "use strict";

    grunt.initConfig({
        less: {
            production: {
                options: {
                    paths: ["less"]
                },
                files: {
                    "public/style.css": "public/style.less"
                }
            }
        }
    });
    grunt.loadNpmTasks("grunt-contrib-less");
    grunt.registerTask("default", ["less"]);
};
