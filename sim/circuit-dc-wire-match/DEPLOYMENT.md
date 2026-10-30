# Moodle deployment requirements — revisions 2 / 3

This SCORM 1.2 package uses the existing Workbench cable interaction with a 64-point limit for new revision-3 attempts and full Float64 geometry. Existing revision-2 attempts retain their 96-point geometry and limits without resampling or changing scores. It requires Moodle's extended suspend-data capacity of 64000 characters; it is NOT compatible with a strict 4096-character LMS.

Before deployment, a Moodle administrator must confirm **Site administration → Plugins → Activity modules → SCORM package → Enable SCORM 1.2 standard mode = No**. This is a site-level setting; the package does not change it. See https://docs.moodle.org/en/SCORM_settings#Other_Important_Settings.

New attempts use revision 3; existing revision-2 attempts resume unchanged. Old revision-1 answers are not silently migrated or erased. Validate same-attempt resume, a large answer, frozen retry, recorded read-only review, scores and real-device gestures in your Moodle player before formal use. If storage is rejected, answers remain in the current page but are not safely saved; do not close it until the configuration/save issue is resolved.

Sites uses the same lossless model in memory and starts fresh on refresh. Sites does not report Moodle grades.
