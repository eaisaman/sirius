'use strict';
var path = require('path');

module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        env: {
            options: {
                //Shared Options Hash
            },
            dev: {
                NODE_ENV: 'development',
                src: 'test/env/mocha-dev.json'
            },
            prod: {
                NODE_ENV: 'production'
            }
        },
        mochaTest: {
            test: {
                options: {
                    reporter: 'spec',
                    captureFile: 'results.txt', // Optionally capture the reporter output to a file
                    quiet: false, // Optionally suppress output to standard out (defaults to false)
                    clearRequireCache: false, // Optionally clear the require cache before running tests (defaults to false)
                    timeout: 30000
                },
                src: ['test/**/*.js']
            }
        }
    });

    // 任务加载
    grunt.loadNpmTasks('grunt-env');
    grunt.loadNpmTasks('grunt-mocha-test');

    // 自定义任务
    grunt.registerTask('test', ['env:dev', 'mochaTest'])
};