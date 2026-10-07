#!/usr/bin/env node
'use strict';
process.argv.push('--platform-core-smoke');
require('./circuit-workbench-browser-regression').main().catch(error=>{console.error(error.stack);process.exitCode=1;});
