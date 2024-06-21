// .. Copyright (C) 2017 Bryan A. Jones.
//
//    This file is part of E-Book Binder.
//
//    E-Book Binder is free software: you can redistribute it and/or modify it
//    under the terms of the GNU General Public License as published by the Free
//    Software Foundation, either version 3 of the License, or (at your option)
//    any later version.
//
//    E-Book Binder is distributed in the hope that it will be useful, but WITHOUT
//    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
//    FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more
//    details.
//
//    You should have received a copy of the GNU General Public License along
//    with E-Book Binder.  If not, see <http://www.gnu.org/licenses/>.
//
// .. highlight:: javascript
//
// **************************************************************************************
// |docname| - JavaScript functions supporting immediate feedback to in-browser questions
// **************************************************************************************

"use strict";

import RunestoneBase from "../../common/js/runestonebase";
import CodeMirror from "codemirror";
import "codemirror/mode/gas/gas.js";
import "codemirror/mode/python/python.js";
import "codemirror/mode/javascript/javascript.js";
import "codemirror/mode/java/java.js";
import "codemirror/mode/sql/sql.js";
import "codemirror/mode/clike/clike.js";
import "codemirror/mode/octave/octave.js";
import "codemirror/lib/codemirror.css";

// Constructor
// ===========
// Object containing all instances of LP problems. (I assume there is just one per page.)
window.LPList = {};

// FITB constructor
class LP extends RunestoneBase {
    constructor(opts) {
        super(opts);
        this.useRunestoneServices = opts.useRunestoneServices;
        // Store the DOM element (the input) for the "Test" button.
        this.element = opts.orig;
        this.containerDiv = this.element;
        this.divid = this.element.id;
        // Store the DOM element (the textarea) where compile results will be displayed.
        this.resultElement = $(this.element).siblings(".lp-result");
        // Store the DOM element (a div) where feedback will be displayed.
        this.feedbackElement = $(this.element)
            .siblings(".lp-feedback")
            .children("div");
        // Use a nice editor.
        this.textAreas = [];
        this.initTextAreas();
        // Handle clicks to the "Save and run" button.
        let that = this;
        $(this.element).click((eventObject) =>
            that.onSaveAndRun(eventObject).then(null)
        );
        this.checkServer("lp_build", true);
    }

    // Look for each code snippet (a textarea). Make it a nice CodeMirror editor.
    initTextAreas(is_read_only = false) {
        let that = this;
        // Select only textareas that haven't been initialized with CodeMirror (which sets style="display:none" on the textarea).
        $('textarea.code_snippet:not([style="display: none;"])').each(function (index, element) {
            let editor = CodeMirror.fromTextArea(element, {
                lineNumbers: true,
                mode: $(that.element).attr("data-lang"),
                indentUnit: 4,
                matchBrackets: true,
                readOnly: is_read_only,
                autoMatchParens: true,
                extraKeys: { Tab: "indentMore", "Shift-Tab": "indentLess" },
            });
            // Make the editor resizable.
            $(editor.getWrapperElement()).resizable({
                resize: function () {
                    editor.setSize($(this).width(), $(this).height());
                    editor.refresh();
                },
            });
            // Keep track of it.
            that.textAreas.push(editor);
        });
    }

    // Data structures:
    //
    // Format of data stored locally and on the server*::
    //
    //  -   answer: JSON-encoded string containing {
    //          code_snippets: [
    //              str, snippet 1, ...
    //          ],
    //          (optional) resultString: str, output from build.
    //      }
    //  -   correct: (optional) float, a percentage from 0 to 100.
    //  -   timestamp: date/time in UTC.
    //
    // Format of data sent to the server*::
    //
    //  -   answer: JSON-encoded string containing only the code_snippets
    //          array, not resultString. There's no point in sending the
    //          previous resultString, since the server will compute a new
    //          one.
    //  -   event: "lp_build"
    //  -   act: "", since the useinfo table requires it. It's not
    //          otherwise used.
    //  -   path: str, giving the relative path to this web page. Used
    //          to find the source code which produced this page in order
    //          to do snippet replacement.
    //  -   div_id: str, the div_id of this component.
    //
    // Format of data received from the server::
    //
    //  If there was an error:
    //  -   errors: [
    //          str, error message 1, ...
    //      ]
    //
    //  Otherwise:
    //  -   answer: JSON-encoded string containing {
    //          resultString: str, output from build.
    //          Note that the code_snippets aren't sent back, to save
    //              bandwidth.
    //      }
    //  -   correct: float, a percentage from 0 to 100.
    //  -   timestamp: str, the server's timestamp.
    //
    // * For simplicity, I omitted the common fields (course, etc.) and discussed only fields unique to this component.

    async onSaveAndRun(_eventObject) {
        // Prevent multiple click while the build is running.
        $(this.element).attr("disabled", true);
        $(this.resultElement).val("Building...");
        $(this.feedbackElement).text("").attr("");
        // Since the Save and run button was clicked, we assume the code snippets have been changed; therefore, don't store ``correct`` or ``answer.resultString`` because they are out of date.
        //
        // Store the answer as a string, since this is what goes in to / comes out from the database. We have to translate this back to a data structure when restoring from the db or local storage.
        let code_snippets = this.textareasToData();
        this.setLocalStorage({
            answer: { code_snippets: code_snippets },
            timestamp: new Date(),
        });
        // Store the answer that the server returns, which includes additional data (correct/incorrect, feedback from the build, etc.).
        let serverAnswer;
        try {
            serverAnswer = await this.logBookEvent({
                event: "lp_build",
                answer: JSON.stringify(code_snippets),
                // This is required by useinfo, but not used.
                act: "",
                // Find the relative path to this web page. Slice off the leading ``/``.
                path: window.location.href
                    .replace(eBookConfig.app, "")
                    .slice(1),
                div_id: this.divid,
            });
        } catch (err) {
            $(this.feedbackElement)
                .val(`Error contacting server: {err}.`)
                .attr("class", "alert alert-danger");
            return;
        } finally {
            // Always re-enable the button after the server responds.
            $(this.element).attr("disabled", false);
        }
        serverAnswer = serverAnswer.detail;
        // The server doesn't return the ``code_snippets``, for efficiency. Include those. If an error was returned, note that there is no ``answer`` yet.
        if (!("answer" in serverAnswer)) {
            serverAnswer.answer = {};
        }
        serverAnswer.answer.code_snippets = code_snippets;
        this.displayAnswer(serverAnswer);
        this.setLocalStorage(serverAnswer);
    }

    // Given a single answer, display it.
    displayAnswer(data) {
        if ("errors" in data) {
            // Display any server-side errors. If this key is present, other keys won't be.
            $(this.feedbackElement)
                .text(data.errors.join("<br>"))
                .attr("class", "alert alert-danger");
        } else {
            // Display and color-code the results.
            $(this.resultElement).val(data.answer.resultString);
            if (data.correct == null) {
                $(this.feedbackElement)
                    .text("Response recorded.")
                    .attr("class", "alert alert-success");
            } else if (data.correct >= 100) {
                $(this.feedbackElement)
                    .text("Correct. Grade: " + data.correct + "%")
                    .attr("class", "alert alert-success");
            } else {
                $(this.feedbackElement)
                    .text("Incorrect. Grade: " + data.correct + "%")
                    .attr("class", "alert alert-danger");
            }
            // Scroll to the bottom of the results.
            $(this.resultElement).scrollTop(this.resultElement[0].scrollHeight);
        }
    }

    // Store the contents of each textarea into an array of strings.
    textareasToData() {
        return $.map(this.textAreas, function (obj, index) {
            // See https://codemirror.net/doc/manual.html#api.
            return obj.getValue();
        });
    }

    // Store an array of strings in ``data.code_snippets`` into each textarea.
    dataToTextareas(data) {
        // For places where textareas aren't provided (instructor grading interface, assignment page), create them. However, these aren't runnable, so disable the "Save and run" button. Assume this is the case when there are no textareas. Reasoning: the page containing the problem contains code intended to be intermingled with the student's answer. If that's not present, we can't build.
        if (!this.textAreas.length) {
            // The unusual case -- a problem not on its original page. Create textareas to display the code, then initialize them. Note that we can't simply create these in the constructor (which would be convenient) since we don't yet know how many code snippets are associated with the problem.
            $(this.element).before((data.answer.code_snippets || []).map(() => `<textarea class="code_snippet"></textarea><br />`));
            // Put CodeMirror in read-only mode.
            this.initTextAreas(true);
            // Disable the "Save and run" button.
            $(this.element).prop("disabled", true);
            // Now that we have textareas, let the usual case code run.
        }

        // The usual case -- a problem on its original page. Find all code snippet textareas.
        $(this.textAreas).each(function (index, value) {
            // Silently ignore if ``data.answer.code_snippets`` or ``data.answer.code_snippets[index]`` isn't defined.
            value.setValue((data.answer.code_snippets || "")[index] || "");
        });
        // Corner case TODO: if a problem is edited after students already submit code so that there are now fewer textareas, display these but don't save them when "Save and run" is pressed. This allows students to (hopefully) re-use code from now-discarded textareas.
    }

    // Restore answers from storage retrieval done in RunestoneBase.
    restoreAnswers(data) {
        // We store the answer as a JSON-encoded string in the db / local storage. Restore the actual data structure from it. Avoid exceptions if no data is available.
        data.answer = JSON.parse(data.answer || "{}");
        this.dataToTextareas(data);
        this.displayAnswer(data);
    }

    checkLocalStorage() {
        // Loads previous answers from local storage if they exist.
        var storedData;
        if (localStorage.length > 0) {
            var key = this.localStorageKey();
            var ex = localStorage.getItem(key);
            if (ex !== null) {
                try {
                    storedData = JSON.parse(ex);
                } catch (err) {
                    // error while parsing; likely due to bad value stored in storage
                    console.log(err.message);
                    localStorage.removeItem(key);
                    return;
                }
                this.restoreAnswers(storedData);
            }
        }
    }

    setLocalStorage(data) {
        // Make a shallow copy, so we can JSON-encode the code snippets (matching what comes from the server) without changing the original object.
        let data_clone = Object.assign({}, data);
        data_clone.answer =  JSON.stringify(data.answer);
        localStorage.setItem(this.localStorageKey(), JSON.stringify(data_clone));
    }
}

// Initialization
// ==============
// Find the custom HTML tags and execute our code on them.
$(document).on("runestone:login-complete", function () {
    $("[data-component=lp_build]").each(function (index) {
        try {
            window.LPList[this.id] = new LP({
                orig: this,
                useRunestoneServices: eBookConfig.useRunestoneServices,
            });
        } catch (err) {
            console.log(`Error rendering LP Problem ${this.id}`);
        }
    });
});

if (typeof window.component_factory === "undefined") {
    window.component_factory = {};
}
window.component_factory["lp_build"] = function (opts) {
    return new LP(opts);
};
