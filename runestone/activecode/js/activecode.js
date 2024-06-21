/**
 *
 * Created by bmiller on 3/19/15.
 */
/* Define global variables for ESLint */
/* global Sk */

"use strict";

import RunestoneBase from "../../common/js/runestonebase.js";
import AudioTour from "./audiotour.js";
import "./activecode-i18n.en.js";
import "./activecode-i18n.pt-br.js";
import "./activecode-i18n.sr-Cyrl.js";
import CodeMirror from "codemirror";
import "codemirror/mode/python/python.js";
import "codemirror/mode/css/css.js";
import "codemirror/mode/htmlmixed/htmlmixed.js";
import "codemirror/mode/xml/xml.js";
import "codemirror/mode/javascript/javascript.js";
import "codemirror/mode/sql/sql.js";
import "codemirror/mode/java/java.js";
import "codemirror/mode/clike/clike.js";
import "codemirror/mode/octave/octave.js";
import "./../css/activecode.css";
import "codemirror/lib/codemirror.css";
import "codemirror/addon/hint/show-hint.js";
import "codemirror/addon/hint/show-hint.css";
import "codemirror/addon/hint/sql-hint.js";
import "codemirror/addon/hint/anyword-hint.js";
import "codemirror/addon/edit/matchbrackets.js";
import "./skulpt.min.js";
import "./skulpt-stdlib.js";
import PyflakesCoach from "./coach-python-pyflakes.js";
// Used by Skulpt.
import embed from "vega-embed";
// Adapt for use outside webpack -- see https://github.com/vega/vega-embed.
window.vegaEmbed = embed;

var isMouseDown = false;
var stopExecution = false;

document.onmousedown = function () {
    isMouseDown = true;
};

document.onmouseup = function () {
    isMouseDown = false;
};
window.edList = {};

var socket, connection, doc;
var chatcodesServer = "chat.codes";

CodeMirror.commands.autocomplete = function(cm) {
    var doc = cm.getDoc();
    var POS = doc.getCursor();
    var mode = CodeMirror.innerMode(cm.getMode(), cm.getTokenAt(POS).state).mode.name;
    console.log(mode)   
    if (mode == 'xml') { //html depends on xml
        CodeMirror.showHint(cm, CodeMirror.hint.html);
    } else if (mode == 'javascript') {
        CodeMirror.showHint(cm, CodeMirror.hint.javascript);
    } else if (mode == 'css') {
        CodeMirror.showHint(cm, CodeMirror.hint.css);
    } else if (mode == 'python') {
        CodeMirror.showHint(cm, CodeMirror.hint.python);
   // } else if (mode == 'cplusplus') {
     //   CodeMirror.showHint(cm, CodeMirror.hint.cplusplus);
    } else {
        CodeMirror.showHint(cm, CodeMirror.hint.cplusplus);
            //cm.showHint({ hint: CodeMirror.hint.anyword });
     }
 };

// separate into constructor and init
export class ActiveCode extends RunestoneBase {
    constructor(opts) {
        super(opts);
        var suffStart;
        var orig = $(opts.orig).find("textarea")[0];
        this.containerDiv = opts.orig;
        this.useRunestoneServices = opts.useRunestoneServices;
        this.python3 = true;
        this.origElem = orig;
        this.origText = this.origElem.textContent;
        this.codeCoachList = [];    //list of CodeCoaches that will be used to provide feedback
        this.divid = opts.orig.id;
        this.code = $(orig).text() || "\n\n\n\n\n";
        this.language = $(orig).data("lang");
        this.timelimit = $(orig).data("timelimit");
        this.includes = $(orig).data("include");
        this.hidecode = $(orig).data("hidecode");
        this.chatcodes = $(orig).data("chatcodes");
        this.hidehistory = $(orig).data("hidehistory");
        this.question = $(opts.orig).find(`#${this.divid}_question`)[0];
        this.tie = $(orig).data("tie");
        this.dburl = $(orig).data("dburl");
        this.runButton = null;
        this.enabledownload = $(orig).data("enabledownload");
        this.downloadButton = null;
        this.saveButton = null;
        this.loadButton = null;
        this.outerDiv = null;
        this.partner = "";
        this.runCount = 0;
        this.logResults = true;
        if (!eBookConfig.allow_pairs || $(orig).data("nopair")) {
            this.enablePartner = false;
        } else {
            this.enablePartner = true;
        }
        this.output = null; // create pre for output
        this.graphics = null; // create div for turtle graphics
        this.codecoach = null; // div for Code Coaches
        this.codelens = null;
        this.controlDiv = null;
        this.historyScrubber = null;
        this.timestamps = ["Original"];
        this.autorun = $(orig).data("autorun");
        this.outputLineCount = 0;
        if (this.chatcodes && eBookConfig.enable_chatcodes) {
            if (!socket) {
                socket = new WebSocket("wss://" + chatcodesServer);
            }
            if (!connection) {
                connection = new window.sharedb.Connection(socket);
            }
            if (!doc) {
                doc = connection.get("chatcodes", "channels");
            }
        }
        if (this.graderactive || this.isTimed) {
            this.hidecode = false;
        }
        if (this.includes) {
            this.includes = this.includes.split(/\s+/);
        }
        let prefixEnd = this.code.indexOf("^^^^");
        if (prefixEnd > -1) {
            this.prefix = this.code.substring(0, prefixEnd);
            this.code = this.code.substring(prefixEnd + 5);
        }
        suffStart = this.code.indexOf("====");
        if (suffStart > -1) {
            // The +5 gets past the ====\n
            this.suffix = this.code.substring(suffStart + 5);
            this.code = this.code.substring(0, suffStart);
        }
        this.history = [this.code];
        this.createEditor();
        this.createOutput();
        this.createControls();
        if ($(orig).data("caption")) {
            this.caption = $(orig).data("caption");
        } else {
            this.caption = "ActiveCode";
        }
        this.addCaption("runestone");

        //Setup CodeCoaches - add based on language
        if (this.language == "python" || this.language == "python3") {
            this.codeCoachList.push(new PyflakesCoach());
        }

        setTimeout(
            function () {
                this.editor.refresh();
            }.bind(this),
            1000
        );
        if (this.autorun) {
            // Simulate pressing the run button, since this will also prevent the user from clicking it until the initial run is complete, and also help the user understand why they're waiting.
            $(this.runButtonHandler.bind(this));
        }
        this.indicate_component_ready();
        if (typeof Prism !== "undefined") {
            Prism.highlightAllUnder(this.containerDiv);
        }
    }

    createEditor(index) {
        this.outerDiv = document.createElement("div");
        var linkdiv = document.createElement("div");
        linkdiv.id = this.divid.replace(/_/g, "-").toLowerCase(); // :ref: changes _ to - so add this as a target
        var codeDiv = document.createElement("div");
        $(codeDiv).addClass("ac_code_div");
        this.codeDiv = codeDiv;
        this.outerDiv.lang = this.language;
        $(this.origElem).replaceWith(this.outerDiv);
        if (linkdiv.id !== this.divid) {
            // Don't want the 'extra' target if they match.
            this.outerDiv.appendChild(linkdiv);
        }
        this.outerDiv.appendChild(codeDiv);
        var edmode = this.outerDiv.lang;
        if (edmode === "sql") {
            edmode = "text/x-sql";
        } else if (edmode === "java") {
            edmode = "text/x-java";
        } else if (edmode === "cpp") {
            edmode = "text/x-c++src";
        } else if (edmode === "c") {
            edmode = "text/x-csrc";
        } else if (edmode === "python3") {
            edmode = "python";
        } else if (edmode === "octave" || edmode === "MATLAB") {
            edmode = "text/x-octave";
        }
        var editor = CodeMirror(codeDiv, {
            value: this.code,
            lineNumbers: true,
            mode: edmode,
            indentUnit: 4,
            matchBrackets: true,
            autoMatchParens: true,
            extraKeys: {
                Tab: "indentMore",
                "Shift-Tab": "indentLess",
                "Ctrl-Space": "autocomplete",
            },
        });
        // Make the editor resizable
        $(editor.getWrapperElement()).resizable({
            resize: function () {
                editor.setSize($(this).width(), $(this).height());
                editor.refresh();
            },
        });
        // give the user a visual cue that they have changed but not saved
        editor.on(
            "change",
            function (ev) {
                if (
                    editor.acEditEvent == false ||
                    editor.acEditEvent === undefined
                ) {
                    // change events can come before any real changes for various reasons, some unknown
                    // this avoids unneccsary log events and updates to the activity counter
                    // offsetParent === null means that the element is not on the screen and so can't change
                    // this.controlDiv.offsetParent
                    if (
                        this.origText === editor.getValue() ||
                        this.addingScrubber
                    ) {
                        console.log("Fake change event, skipping the log");
                        return;
                    }
                    $(editor.getWrapperElement()).css(
                        "border-top",
                        "2px solid #b43232"
                    );
                    $(editor.getWrapperElement()).css(
                        "border-bottom",
                        "2px solid #b43232"
                    );
                    this.isAnswered = true;
                    // the first time the student types in the write-code box
                    this.logBookEvent({
                        event: "activecode",
                        act: "edit",
                        div_id: this.divid,
                    });
                }
                editor.acEditEvent = true;
            }.bind(this)
        ); // use bind to preserve *this* inside the on handler.
        //Solving Keyboard Trap of ActiveCode: If user use tab for navigation outside of ActiveCode, then change tab behavior in ActiveCode to enable tab user to tab out of the textarea
        $(window).keydown(function (e) {
            var code = e.keyCode ? e.keyCode : e.which;
            if (code == 9 && $("textarea:focus").length === 0) {
                editor.setOption("extraKeys", {
                    Tab: function (cm) {
                        $(document.activeElement)
                            .closest(".tab-content")
                            .nextSibling.focus();
                    },
                    "Shift-Tab": function (cm) {
                        $(document.activeElement)
                            .closest(".tab-content")
                            .previousSibling.focus();
                    },
                });
            }
        });
        this.editor = editor;
        if (this.hidecode) {
            $(this.codeDiv).css("display", "none");
        }
    }

    async runButtonHandler() {
        // Disable the run button until the run is finished.
        this.runButton.disabled = true;
        try {
            await this.runProg();
        } catch (e) {
            console.log(`there was an error ${e} running the code`);
        }
        if (this.logResults) {
            this.logCurrentAnswer();
        }
        this.runCoaches();
        this.renderFeedback();
        // The run is finished; re-enable the button.
        this.runButton.disabled = false;
        this.runCount += 1;
        this.toggleAlert();
    }

    createControls() {
        var ctrlDiv = document.createElement("div");
        var butt;
        $(ctrlDiv).addClass("ac_actions");
        // Run
        butt = document.createElement("button");
        $(butt).text($.i18n("msg_activecode_run_code"));
        $(butt).addClass("btn btn-success run-button");
        ctrlDiv.appendChild(butt);
        this.runButton = butt;
        // console.log("adding click function for run");
        this.runButton.onclick = this.runButtonHandler.bind(this);
        $(butt).attr("type", "button");

        if (this.enabledownload || eBookConfig.downloadsEnabled) {
            this.addDownloadButton(ctrlDiv);
        }
        if (!this.hidecode && !this.hidehistory) {
            this.addHistoryScrubber(true);
        }
        if ($(this.origElem).data("gradebutton") && !this.graderactive) {
            this.addFeedbackButton(ctrlDiv);
        }
        // Show/Hide Code
        if (this.hidecode) {
            this.enableHideShow(ctrlDiv);
        }
        // CodeLens
        if ($(this.origElem).data("codelens") && !this.graderactive) {
            this.enableCodeLens(ctrlDiv);
        }
        // Audio Tour
        if ($(this.origElem).data("audio")) {
            this.enableAudioTours(ctrlDiv);
        }
        if (eBookConfig.isInstructor) {
            this.enableInstructorSharing(ctrlDiv);
        }
        if (this.enablePartner) {
            this.setupPartner(ctrlDiv);
        }
        if (this.chatcodes && eBookConfig.enable_chatcodes) {
            this.enableChatCodes(ctrlDiv);
        }

        $(this.outerDiv).prepend(ctrlDiv);
        if (this.question) {
            if ($(this.question).html().match(/^\s+$/)) {
                $(this.question).remove();
            } else {
                $(this.outerDiv).prepend(this.question);
            }
        }
        this.controlDiv = ctrlDiv;
    }

    addFeedbackButton(ctrlDiv) {
        let butt = document.createElement("button");
        $(butt).addClass("ac_opt btn btn-default");
        $(butt).text($.i18n("msg_activecode_show_feedback"));
        $(butt).css("margin-left", "10px");
        $(butt).attr("type", "button");
        this.gradeButton = butt;
        ctrlDiv.appendChild(butt);
        $(butt).click(this.createGradeSummary.bind(this));
    }

    addDownloadButton(ctrlDiv) {
        let butt = document.createElement("button");
        $(butt).text("Download");
        $(butt).addClass("btn save-button");
        ctrlDiv.appendChild(butt);
        this.downloadButton = butt;
        $(butt).click(this.downloadFile.bind(this, this.language));
        $(butt).attr("type", "button");
    }

    enableHideShow(ctrlDiv) {
        $(this.runButton).attr("disabled", "disabled");
        let butt = document.createElement("button");
        $(butt).addClass("ac_opt btn btn-default");
        $(butt).text($.i18n("msg_activecode_show_code"));
        $(butt).css("margin-left", "10px");
        $(butt).attr("type", "button");
        this.showHideButt = butt;
        ctrlDiv.appendChild(butt);
        $(butt).click(
            function () {
                $(this.codeDiv).toggle();
                if (this.historyScrubber == null) {
                    this.addHistoryScrubber(true);
                } else {
                    $(this.historyScrubber.parentElement).toggle();
                }
                if (
                    $(this.showHideButt).text() ==
                    $.i18n("msg_activecode_show_code")
                ) {
                    $(this.showHideButt).text(
                        $.i18n("msg_activecode_hide_code")
                    );
                } else {
                    $(this.showHideButt).text(
                        $.i18n("msg_activecode_show_code")
                    );
                }
                if ($(this.runButton).attr("disabled")) {
                    $(this.runButton).removeAttr("disabled");
                } else {
                    $(this.runButton).attr("disabled", "disabled");
                }
            }.bind(this)
        );
    }

    enableCodeLens(ctrlDiv) {
        let butt = document.createElement("button");
        $(butt).addClass("ac_opt btn btn-default");
        $(butt).text($.i18n("msg_activecode_show_codelens"));
        $(butt).css("margin-left", "10px");
        this.clButton = butt;
        ctrlDiv.appendChild(butt);
        $(butt).click(this.showCodelens.bind(this));
    }

    enableAudioTours(ctrlDiv) {
        let butt = document.createElement("button");
        $(butt).addClass("ac_opt btn btn-default");
        $(butt).text($.i18n("msg_activecode_audio_tour"));
        $(butt).css("margin-left", "10px");
        this.atButton = butt;
        ctrlDiv.appendChild(butt);
        $(butt).click(
            function () {
                new AudioTour(
                    this.divid,
                    this.code,
                    1,
                    $(this.origElem).data("audio")
                );
            }.bind(this)
        );
    }

    enableInstructorSharing(ctrlDiv) {
        let butt = document.createElement("button");
        $(butt).addClass("btn btn-info");
        $(butt).text("Share Code");
        $(butt).css("margin-left", "10px");
        this.shareButt = butt;
        ctrlDiv.appendChild(butt);
        $(butt).click(
            async function () {
                if (
                    !confirm(
                        "You are about to share this code with ALL of your students.  Are you sure you want to continue?"
                    )
                ) {
                    return;
                }
                let data = {
                    divid: this.divid,
                    code: this.editor.getValue(),
                    lang: this.language,
                };
                let request = new Request(
                    eBookConfig.ajaxURL + "broadcast_code.json",
                    {
                        method: "POST",
                        headers: this.jsonHeaders,
                        body: JSON.stringify(data),
                    }
                );
                let post_promise = await fetch(request);
                let status = await post_promise.json();
                if (status.mess === "success") {
                    alert(`Shared Code with ${status.share_count} students`);
                } else {
                    alert("Sharing Failed");
                }
            }.bind(this)
        );
    }

    setupPartner(ctrlDiv) {
        var checkPartner = document.createElement("input");
        checkPartner.type = "checkbox";
        checkPartner.id = `${this.divid}_part`;
        ctrlDiv.appendChild(checkPartner);
        var plabel = document.createElement("label");
        plabel.for = `${this.divid}_part`;
        $(plabel).text("Pair?");
        ctrlDiv.appendChild(plabel);
        $(checkPartner).click(
            function () {
                if (this.partner) {
                    this.partner = false;
                    $(partnerTextBox).hide();
                    this.partner = "";
                    partnerTextBox.value = "";
                    $(plabel).text("Pair?");
                } else {
                    let didAgree = localStorage.getItem("partnerAgree");
                    if (!didAgree) {
                        didAgree = confirm(
                            "Pair Programming should only be used with the consent of your instructor." +
                                "Your partner must be a registered member of the class and have agreed to pair with you." +
                                "By clicking OK you certify that both of these conditions have been met."
                        );
                        if (didAgree) {
                            localStorage.setItem("partnerAgree", "true");
                        } else {
                            return;
                        }
                    }
                    this.partner = true;
                    $(plabel).text("with: ");
                    $(partnerTextBox).show();
                }
            }.bind(this)
        );
        var partnerTextBox = document.createElement("input");
        partnerTextBox.type = "text";
        ctrlDiv.appendChild(partnerTextBox);
        $(partnerTextBox).hide();
        $(partnerTextBox).change(
            function () {
                this.partner = partnerTextBox.value;
            }.bind(this)
        );
    }

    // This is probably obsolete.  Not sure if anyone at Michigan will come back
    // to working on this again.
    enableChatCodes(ctrlDiv) {
        var chatBar = document.createElement("div");
        var channels = document.createElement("span");
        var topic = window.location.host + "-" + this.divid;
        ctrlDiv.appendChild(chatBar);
        $(chatBar).text("Chat: ");
        $(chatBar).append(channels);
        let butt = document.createElement("a");
        $(butt).addClass("ac_opt btn btn-default");
        $(butt).text("Create Channel");
        $(butt).css("margin-left", "10px");
        $(butt).attr("type", "button");
        $(butt).attr("target", "_blank");
        $(butt).attr(
            "href",
            "http://" +
                chatcodesServer +
                "/new?" +
                $.param({
                    topic: window.location.host + "-" + this.divid,
                    code: this.editor.getValue(),
                    lang: "Python",
                })
        );
        this.chatButton = butt;
        chatBar.appendChild(butt);
        var updateChatCodesChannels = function () {
            var data = doc.data;
            var i = 1;
            $(channels).html("");
            data["channels"].forEach(function (channel) {
                if (!channel.archived && topic === channel.topic) {
                    var link = $("<a />");
                    var href =
                        "http://" + chatcodesServer + "/" + channel.channelName;
                    link.attr({
                        href: href,
                        target: "_blank",
                    });
                    link.text(" " + channel.channelName + "(" + i + ") ");
                    $(channels).append(link);
                    i++;
                }
            });
            if (i === 1) {
                $(channels).text("(no active converstations on this problem)");
            }
        };
        doc.subscribe(updateChatCodesChannels);
        doc.on("op", updateChatCodesChannels);
    }

    enableSaveLoad() {
        $(this.runButton).text($.i18n("msg_activecode_save_run"));
    }

    // _`addHistoryScrubber`
    // ---------------------
    // Activecode -- If the code has not changed wrt the scrubber position value then don't save the code or reposition the scrubber
    //  -- still call runlog, but add a parameter to not save the code
    // add an initial load history button
    // if there is no edit then there is no append   to_save (True/False)
    async addHistoryScrubber(pos_last) {
        this.addingScrubber = true;
        let response;
        var reqData = {
            acid: this.divid,
        };
        if (this.sid !== undefined) {
            reqData["sid"] = this.sid;
        }
        console.log("before get hist");
        if (
            eBookConfig.practice_mode ||
            !eBookConfig.isLoggedIn ||
            (this.isTimed && !this.assessmentTaken)
        ) {
            // If this is timed and already taken we should restore history info
            this.renderScrubber();
        } else {
            let request = new Request(
                `${eBookConfig.new_server_prefix}/assessment/gethist`,
                {
                    method: "POST",
                    headers: this.jsonHeaders,
                    body: JSON.stringify(reqData),
                }
            );
            try {
                response = await fetch(request);
                let data = await response.json();
                if (!response.ok) {
                    throw new Error(
                        `Failed to get the history data: ${data.detail}`
                    );
                }
                data = data.detail;
                if (data.history !== undefined) {
                    this.history = this.history.concat(data.history);
                    for (let t in data.timestamps) {
                        this.timestamps.push(
                            new Date(data.timestamps[t]).toLocaleString()
                        );
                    }
                }
            } catch (e) {
                console.log(`unable to fetch history: ${e}`);
            }
            this.renderScrubber(pos_last);
        }
        this.addingScrubber = false;
        return "success";
    }

    renderScrubber(pos_last) {
        console.log("making a new scrubber");
        var scrubberDiv = document.createElement("div");
        $(scrubberDiv).css("display", "inline-block");
        $(scrubberDiv).css("margin-left", "10px");
        $(scrubberDiv).css("margin-right", "10px");
        $(scrubberDiv).css({
            "min-width": "200px",
            "max-width": "300px",
        });
        var scrubber = document.createElement("div");
        this.timestampP = document.createElement("span");
        this.slideit = function (ev, el) {
            this.editor.setValue(this.history[$(scrubber).slider("value")]);
            var curVal = this.timestamps[$(scrubber).slider("value")];
            let pos = $(scrubber).slider("value");
            let outOf = this.history.length;
            $(this.timestampP).text(`${curVal} - ${pos + 1} of ${outOf}`);
            // a slide will also result in a slidechange event we don't want to double
            // log these events.  So do not log the slide until it stops and creates the changed
            if (ev !== null && ev.type != "slide") {
                this.logBookEvent({
                    event: "activecode",
                    act: "slide:" + curVal,
                    div_id: this.divid,
                });
            }
        };
        $(scrubber).slider({
            max: this.history.length - 1,
            value: this.history.length - 1,
        });
        $(scrubber).css("margin", "10px");
        $(scrubber).on("slide", this.slideit.bind(this));
        $(scrubber).on("slidechange", this.slideit.bind(this));
        scrubberDiv.appendChild(scrubber);
        scrubberDiv.appendChild(this.timestampP);
        // If there is a deadline set then position the scrubber at the last submission
        // prior to the deadline
        if (this.deadline) {
            let i = 0;
            let done = false;
            while (i < this.history.length && !done) {
                if (new Date(this.timestamps[i]) > this.deadline) {
                    done = true;
                } else {
                    i += 1;
                }
            }
            i = i - 1;
            scrubber.value = Math.max(i, 0);
            this.editor.setValue(this.history[scrubber.value]);
            $(scrubber).slider("value", scrubber.value);
        } else if (pos_last) {
            scrubber.value = this.history.length - 1;
            this.editor.setValue(this.history[scrubber.value]);
        } else {
            scrubber.value = 0;
        }
        let pos = $(scrubber).slider("value");
        let outOf = this.history.length;
        let ts = this.timestamps[$(scrubber).slider("value")];
        $(this.timestampP).text(`${ts} - ${pos + 1} of ${outOf}`);
        this.historyScrubber = scrubber;
        $(scrubberDiv).insertAfter(this.runButton);
    } // end definition of helper

    createOutput() {
        // Create a parent div with two elements:  pre for standard output and a div
        // to hold turtle graphics output.  We use a div in case the turtle changes from
        // using a canvas to using some other element like svg in the future.
        var outDiv = document.createElement("div");
        $(outDiv).addClass("ac_output");
        this.outDiv = outDiv;
        this.output = document.createElement("pre");
        this.output.id = this.divid + "_stdout";
        $(this.output).css("visibility", "hidden");
        $(this.output).css("max-height", "400px");
        $(this.output).css("overflow", "auto");
        this.graphics = document.createElement("div");
        this.graphics.id = this.divid + "_graphics";
        $(this.graphics).addClass("ac-canvas");
        // This bit of magic adds an event which waits for a canvas child to be created on our
        // newly created div.  When a canvas child is added we add a new class so that the visible
        // canvas can be styled in CSS.  Which a the moment means just adding a border.
        $(this.graphics).on(
            "DOMNodeInserted",
            "canvas",
            function () {
                $(this.graphics).addClass("visible-ac-canvas");
            }.bind(this)
        );

        var coachDiv = document.createElement("div");
        coachDiv.classList.add("alert", "alert-warning", "codecoach");
        $(coachDiv).css("display", "none");
        let coachHead = coachDiv.appendChild(document.createElement("h3"));
        coachHead.textContent = $.i18n("msg_activecode_code_coach");
        this.outerDiv.appendChild(coachDiv);
        this.codecoach = coachDiv;

        outDiv.appendChild(this.output);
        outDiv.appendChild(this.graphics);
        this.outerDiv.appendChild(outDiv);
        var lensDiv = document.createElement("div");
        lensDiv.classList.add("codelens");
        lensDiv.id = `${this.divid}_codelens`;
        $(lensDiv).css("display", "none");
        this.codelens = lensDiv;
        this.outerDiv.appendChild(lensDiv);
    }

    disableSaveLoad() {
        $(this.saveButton).addClass("disabled");
        $(this.saveButton).attr("title", "Login to save your code");
        $(this.loadButton).addClass("disabled");
        $(this.loadButton).attr("title", "Login to load your code");
    }

    downloadFile(lang) {
        var fnb = this.divid;
        var d = new Date();
        var fileName =
            fnb +
            "_" +
            d
                .toJSON()
                .substring(0, 10) // reverse date format
                .split("-")
                .join("") +
            "." +
            languageExtensions[lang];
        var code = this.editor.getValue();
        if ("Blob" in window) {
            var textToWrite = code.replace(/\n/g, "\r\n");
            var textFileAsBlob = new Blob([textToWrite], {
                type: "text/plain",
            });
            if ("msSaveOrOpenBlob" in navigator) {
                navigator.msSaveOrOpenBlob(textFileAsBlob, fileName);
            } else {
                var downloadLink = document.createElement("a");
                downloadLink.download = fileName;
                downloadLink.innerHTML = "Download File";
                downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
                downloadLink.style.display = "none";
                document.body.appendChild(downloadLink);
                downloadLink.click();
            }
        } else {
            alert("Your browser does not support the HTML5 Blob.");
        }
    }

    async createGradeSummary() {
        // get grade and comments for this assignment
        // get summary of all grades for this student
        // display grades in modal window
        var data = {
            div_id: this.divid,
        };
        let request = new Request(eBookConfig.ajaxURL + "getassignmentgrade", {
            method: "POST",
            headers: this.jsonHeaders,
            body: JSON.stringify(data),
        });
        let response = await fetch(request);
        let report = await response.json();
        var body;
        // check for report['message']
        if (report) {
            if (report["version"] == 2) {
                // new version; would be better to embed this in HTML for the activecode
                body =
                    "<h4>Grade Report</h4>" +
                    "<p>This question: " +
                    report["grade"];
                if (report["released"]) {
                    body += " out of " + report["max"];
                }
                body += "</p> <p>";
                if (report["released"] == false) {
                    body += "Preliminary Comments: ";
                }
                body += report["comment"] + "</p>";
            } else {
                body =
                    "<h4>Grade Report</h4>" +
                    "<p>This assignment: " +
                    report["grade"] +
                    "</p>" +
                    "<p>" +
                    report["comment"] +
                    "</p>" +
                    "<p>Number of graded assignments: " +
                    report["count"] +
                    "</p>" +
                    "<p>Average score: " +
                    report["avg"] +
                    "</p>";
            }
        } else {
            body = "<h4>The server did not return any grade information</h4>";
        }
        var html = `<div class="modal fade">
                  <div class="modal-dialog compare-modal">
                    <div class="modal-content">
                      <div class="modal-header">
                        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                        <h4 class="modal-title">Assignment Feedback</h4>
                      </div>
                      <div class="modal-body">
                        ${body}
                      </div>
                    </div>
                  </div>
                </div>`;
        var el = $(html);
        el.modal();

        return response;
    }

    async showCodelens() {
        if (this.codelens.style.display == "none") {
            this.codelens.style.display = "block";
            this.clButton.innerText = $.i18n("msg_activecode_hide_codelens");
        } else {
            this.codelens.style.display = "none";
            this.clButton.innerText = $.i18n("msg_activecode_show_in_codelens");
            return;
        }
        var cl = this.codelens.firstChild;
        if (cl) {
            this.codelens.removeChild(cl);
        }
        var code = await this.buildProg(false);
        var myVars = {};
        myVars.code = code;
        myVars.origin = "opt-frontend.js";
        myVars.cumulative = false;
        myVars.heapPrimitives = false;
        myVars.drawParentPointers = false;
        myVars.textReferences = false;
        myVars.showOnlyOutputs = false;
        myVars.rawInputLstJSON = JSON.stringify([]);
        if (this.language == "python") {
            if (this.python3) {
                myVars.py = 3;
            } else {
                myVars.py = 2;
            }
        } else if (this.langauge == "javascript") {
            myVars.py = "js";
        } else {
            myVars.py = this.language;
        }
        myVars.curInstr = 0;
        myVars.codeDivWidth = 350;
        myVars.codeDivHeight = 400;
        var srcURL = "https://pythontutor.com/iframe-embed.html";
        var srcVars = $.param(myVars);
        var embedUrlStr = `${srcURL}#${srcVars}`;
        var myIframe = document.createElement("iframe");
        myIframe.setAttribute("id", this.divid + "_codelens");
        myIframe.setAttribute("width", "100%");
        myIframe.setAttribute("height", "500");
        myIframe.setAttribute("style", "display:block");
        myIframe.style.background = "#fff";
        //myIframe.setAttribute("src",srcURL)
        myIframe.src = embedUrlStr;
        this.codelens.appendChild(myIframe);
        this.logBookEvent({
            event: "codelens",
            act: "view",
            div_id: this.divid,
        });
    }

    toggleEditorVisibility() {}

    addErrorMessage(err) {
        // Add the error message
        this.errLastRun = true;
        var errHead = $("<h3>").html("Error");
        this.eContainer = this.outerDiv.appendChild(
            document.createElement("div")
        );
        this.eContainer.className = "error alert alert-danger";
        this.eContainer.id = this.divid + "_errinfo";
        this.eContainer.appendChild(errHead[0]);
        var errText = this.eContainer.appendChild(
            document.createElement("pre")
        );
        // But, adjust the line numbers.  If the line number is <= pretextLines then it is in included code
        // if it is greater than the number of included lines but less than the pretext + current editor then it is in the student code.
        // adjust the line number we display by eliminating the pre-included code.
        if (err.traceback.length >= 1) {
            var errorLine = err.traceback[0].lineno;
            if (errorLine <= this.pretextLines) {
                errText.innerHTML =
                    "An error occurred in the hidden, included code. Sorry we can't give you a more helpful error message";
                return;
            } else if (errorLine > this.progLines + this.pretextLines) {
                errText.innerHTML = `An error occurred after the end of your code.
One possible reason is that you have an unclosed parenthesis or string.
Another possibility is that there is an error in the hidden test code.
Yet another is that there is an internal error.  The internal error message is: ${err.message}`;
                return;
            } else {
                if (this.pretextLines > 0) {
                    err.traceback[0].lineno =
                        err.traceback[0].lineno - this.pretextLines + 1;
                }
            }
        }
        var errString = err.toString();
        var to = errString.indexOf(":");
        var errName = errString.substring(0, to);
        errText.innerHTML = errString;
        $(this.eContainer).append("<h3>Description</h3>");
        var errDesc = this.eContainer.appendChild(document.createElement("p"));
        errDesc.innerHTML = errorText[errName];
        $(this.eContainer).append("<h3>To Fix</h3>");
        var errFix = this.eContainer.appendChild(document.createElement("p"));
        errFix.innerHTML = errorText[errName + "Fix"];
        var moreInfo = "../ErrorHelp/" + errName.toLowerCase() + ".html";
        //console.log("Runtime Error: " + err.toString());
    }
    setTimeLimit(timer) {
        var timelimit = this.timelimit;
        if (timer !== undefined) {
            timelimit = timer;
        }
        // set execLimit in milliseconds  -- for student projects set this to
        // 25 seconds -- just less than Chrome's own timer.
        if (
            this.code.indexOf("ontimer") > -1 ||
            this.code.indexOf("onclick") > -1 ||
            this.code.indexOf("onkey") > -1 ||
            this.code.indexOf("setDelay") > -1
        ) {
            Sk.execLimit = null;
        } else {
            if (timelimit === "off") {
                Sk.execLimit = null;
            } else if (timelimit) {
                Sk.execLimit = timelimit;
            } else {
                Sk.execLimit = 25000;
            }
        }
    }
    builtinRead(x) {
        if (
            Sk.builtinFiles === undefined ||
            Sk.builtinFiles["files"][x] === undefined
        )
            throw $.i18n("msg_activecode_file_not_found", x);
        return Sk.builtinFiles["files"][x];
    }
    fileReader(divid) {
        // In the beginning files were just pre tags and we used the divid as the filename
        let elem = document.getElementById(divid);
        // In PreTeXt we moved that to a @data-filename
        if (elem === null) {
            elem = document.querySelector(`[data-filename="${divid}"]`);
        }
        let data = "";
        let result = "";
        if (elem == null && Sk.builtinFiles.files.hasOwnProperty(divid)) {
            return Sk.builtinFiles["files"][divid];
        } else {
            // try remote file unless it ends with .js or .py -- otherwise we'll ask the server for all
            // kinds of modules that we are trying to import
            if (!(divid.endsWith(".js") || divid.endsWith(".py"))) {
                $.ajax({
                    async: false,
                    url: `/runestone/ajax/get_datafile?course_id=${eBookConfig.course}&acid=${divid}`,
                    success: function (data) {
                        result = JSON.parse(data).data;
                    },
                    error: function (err) {
                        result = null;
                    },
                });
                if (result) {
                    return result;
                }
            }
        }
        if (elem == null && result === null) {
            throw new Sk.builtin.IOError(
                $.i18n("msg_activecode_no_file_or_dir", divid)
            );
        } else {
            // for backward compatibility - early on we had textarea with the divid on it.
            // but later this switched to a runestone wrapper.  So we may need to dig for a pre
            // or a textarea?
            if (elem.nodeName.toLowerCase() == "textarea") {
                data = elem.value;
            } else {
                let pre = elem.querySelector("pre");
                if (pre) {
                    data = pre.textContent;
                } else {
                    data = elem.textContent;
                }
            }
        }
        return data;
    }
    outputfun(text) {
        // bnm python 3
        if (this.outputLineCount > 1000) return;
        $(this.output).css("visibility", "visible");
        text = text
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br/>");
        // todo: try to make this use the suspension mechanism in skulpt
        return new Sk.misceval.promiseToSuspension(new Promise(function (resolve) {
                setTimeout(
                    function () {
                        if (this.outputLineCount < 1000) {
                            $(this.output).append(text);
                            this.outputLineCount += 1;
                            resolve(Sk.builtin.none.none$)
                        } else {
                            if (this.outputLineCount == 1000) {
                                $(this.output).append("Too Much output");
                                this.outputLineCount += 1;
                                stopExecution = true;
                                resolve(Sk.builtin.none.none$)
                            }
                        }
                    }.bind(this),
                    1
                );
            }.bind(this)
        ));
    }

    filewriter(fobj, bytes) {
        let filecomponent = document.getElementById(fobj.name);
        if (!filecomponent) {
            let container = document.createElement("div");
            $(container).addClass("runestone");
            let tab = document.createElement("div");
            $(tab).addClass("datafile_caption");
            tab.innerHTML = `Data file: <code>${fobj.name}</code>`;
            filecomponent = document.createElement("textarea");
            filecomponent.rows = 10;
            filecomponent.cols = 50;
            filecomponent.id = fobj.name;
            $(filecomponent).css("margin-bottom", "5px");
            $(filecomponent).addClass("ac_output");
            container.appendChild(tab);
            container.appendChild(filecomponent);
            this.outerDiv.appendChild(container);
        } else {
            if (fobj.pos$ == 0) {
                $(filecomponent).val("");
            }
        }
        let current = $(filecomponent).val();
        current = current + bytes.v;
        $(filecomponent).val(current);
        $(filecomponent).css("display", "block");
        fobj.pos$ = current.length;
        return current.length;
    }

    async getIncludedCode(divid) {
        if (window.edList[divid]) {
            return window.edList[divid].editor.getValue();
        } else {
            let request = new Request(
                `/runestone/ajax/get_datafile?course_id=${eBookConfig.course}&acid=${divid}`,
                {
                    method: "GET",
                    headers: this.jsonHeaders,
                }
            );
            let wresult = await fetch(request);
            let obj = await wresult.json();
            return obj.data;
        }
    }

    async buildProg(useSuffix) {
        // assemble code from prefix, suffix, and editor for running.
        var pretext;
        var prog = this.editor.getValue() + "\n";
        if (this.prefix) {
            prog = this.prefix + prog;
        }
        this.pretext = "";
        this.pretextLines = 0;
        this.progLines = prog.match(/\n/g).length + 1;
        if (this.includes) {
            // iterate over the includes, in-order prepending to prog
            pretext = "";
            for (var x = 0; x < this.includes.length; x++) {
                let iCode = await this.getIncludedCode(this.includes[x]);
                pretext = pretext + iCode + "\n";
            }
            this.pretext = pretext;
            if (this.pretext) {
                this.pretextLines = (this.pretext.match(/\n/g) || "").length;
            }
            prog = pretext + prog;
        }
        if (useSuffix && this.suffix) {
            prog = prog + this.suffix;
        }
        return Promise.resolve(prog);
    }

    async manage_scrubber(saveCode) {
        if (this.historyScrubber === null && !this.autorun) {
            await this.addHistoryScrubber();
        }
        if (
            this.historyScrubber &&
            this.history[$(this.historyScrubber).slider("value")] !=
                this.editor.getValue()
        ) {
            saveCode = "True";
            this.history.push(this.editor.getValue());
            this.timestamps.push(new Date().toLocaleString());
            $(this.historyScrubber).slider(
                "option",
                "max",
                this.history.length - 1
            );
            $(this.historyScrubber).slider(
                "option",
                "value",
                this.history.length - 1
            );
            this.slideit(null);
        } else {
            saveCode = "False";
        }
        if (this.historyScrubber == null) {
            saveCode = "False";
        }
        return saveCode;
    }

    async checkCurrentAnswer() {
        try {
            await this.runProg();
        } catch (e) {
            console.log(`error running code ${e}`);
        }
    }

    // the sid parameter is optional and is used for group submissions
    async logCurrentAnswer(sid) {
        let data = {
            div_id: this.divid,
            code: this.editor.getValue(),
            language: this.language,
            errinfo: this.errinfo || "",
            to_save: this.saveCode || "F",
            prefix: this.pretext,
            suffix: this.suffix,
            partner: this.partner,
        }; // Log the run event
        if (typeof sid !== "undefined") {
            data.sid = sid;
        }
        await this.logRunEvent(data);
        // If unit tests were run there will be a unit_results
        if (this.unit_results) {
            let unitData = {
                act: this.unit_results,
                div_id: this.divid,
                event: "unittest",
            };
            if (typeof sid !== "undefined") {
                unitData.sid = sid;
            }
            await this.logBookEvent(unitData);
        }
    }

    async runCoaches() {
        //Run all available code coaches and update code coach div

        //clear anything after header in codecoach div and hide it
        $(this.codecoach).children().slice(1).remove();
        $(this.codecoach).css("display", "none");

        //get code, run coaches
        let code = await this.buildProg(false);
        let results = [];
        for(let coach of this.codeCoachList) {
            results.push(coach.check(code));
        }

        //once all coaches are done, update div
        Promise.allSettled(results).then((promises) => {
            for(let p of promises) {
                if(p.status === 'fulfilled' && p.value !== null && p.value.trim() !== "") {
                    let checkDiv = document.createElement("div");
                    checkDiv.classList.add("python_check_results");
                    let checkPre = checkDiv.appendChild(document.createElement("pre"));
                    checkPre.textContent = p.value;
                    this.codecoach.append(checkDiv);
                    $(this.codecoach).css("display", "block");
                }
            }
        });
    }

    renderFeedback() {
        // The python unit test code builds the table as it is running the tests
        // In "normal" usage this is displayed immediately.
        // However in exam mode we make a div which is offscreen
        if (this.unit_results_divid) {
            if (this.unit_results_divid.indexOf("_offscreen_") > 0) {
                let urDivid = `${this.divid}_offscreen_unit_results`;
                let unitFeedback = document.getElementById(urDivid);
                let tmp = document.body.removeChild(unitFeedback);
                if ($(this.outerDiv).find(`#${urDivid}`).length > 0) {
                    tmp = $(this.outerDiv).find(`#${urDivid}`)[0];
                } else {
                    this.outerDiv.appendChild(tmp);
                }
                $(tmp).show();
            } else {
                let urDivid = this.divid + "_unit_results";
                if (
                    $(this.outerDiv).find(`#${urDivid}`).length == 0 &&
                    $(this.outerDiv).find(`#${urDivid}_offscreen_unit_results`)
                        .length == 0
                ) {
                    let urResults = document.getElementById(urDivid);
                    this.outerDiv.appendChild(urResults);
                }
            }
        }
    }

    toggleAlert() {
        if (this.is_toggle && this.runCount == 3) {
            if (
                this.errinfo != "success" ||
                this.unit_results.substring(8, 11) != 100.0
            ) {
                setTimeout(function () {
                    alert(
                        "Help is Available Using the Toggle Question Selector! You can try the Mixed-up Question first."
                    );
                }, 500);
                this.logBookEvent({
                    event: "togglealert",
                    act: "Help is Available Using the Toggle Question Selector",
                    div_id: this.divid,
                });
            }
        }
    }

    /* runProg has several async elements to it.
     * 1. Skulpt runs the python program asynchronously
     * 2. The history is restored asynchronously
     * 3. Logging is asynchronous
     *
     * This method returns the skulpt Promise and so the promise will resolve when skulpt is finished.
     * when finished this.unit_results will contain the results of any unit tests that have been run.
     * The table of results is constructed and added to the DOM by the python unittest.gui module in skulpt.
     *
     */
    async runProg(noUI, logResults) {
        console.log("starting runProg");
        stopExecution = false;
        this.outputLineCount = 0;
        if (typeof logResults === "undefined") {
            this.logResults = true;
        } else {
            this.logResults = logResults;
        }
        if (typeof noUI !== "boolean") {
            noUI = false;
        }
        var prog = await this.buildProg(true);
        this.saveCode = "True";
        $(this.output).text("");

        while ($(`#${this.divid}_errinfo`).length > 0) {
            $(`#${this.divid}_errinfo`).remove();
        }
        //$(this.eContainer).remove();
        if (this.codelens) {
            this.codelens.style.display = "none";
        }
        if (this.clButton) {
            this.clButton.innerText = $.i18n("msg_activecode_show_in_codelens");
        }
        Sk.configure({
            output: this.outputfun.bind(this),
            read: this.fileReader,
            filewrite: this.filewriter.bind(this),
            __future__: Sk.python3,
            nonreadopen: true,
            //        python3: this.python3,
            imageProxy: "http://image.runestone.academy:8080/320x",
            inputfunTakesPrompt: true,
            jsonpSites: ["https://itunes.apple.com"],
        });
        Sk.divid = this.divid;
        Sk.logResults = logResults;
        if (this.graderactive && this.outerDiv.closest(".loading")) {
            Sk.gradeContainer = this.outerDiv.closest(".loading").id;
        } else {
            Sk.gradeContainer = this.divid;
        }
        this.setTimeLimit();
        (Sk.TurtleGraphics || (Sk.TurtleGraphics = {})).target = this.graphics;
        Sk.canvas = this.graphics.id; //todo: get rid of this here and in image
        if (!noUI) {
            this.saveCode = await this.manage_scrubber(this.saveCode);
            $(this.runButton).attr("disabled", "disabled");
            $(this.historyScrubber).off("slidechange");
            $(this.historyScrubber).slider("disable");
            $(this.outDiv).show({
                duration: 700,
                queue: false,
            });
        }
        try {
            await Sk.misceval.asyncToPromise(function () {
                return Sk.importMainWithBody("<stdin>", false, prog, true);
            }, { // suspension handlers
            "*": () => {
                if (stopExecution) {
                    console.log("stopExecution is true")
                    throw new Error(`Too much output`);
                }
            },
            });
            if (!noUI) {
                if (this.slideit) {
                    $(this.historyScrubber).on(
                        "slidechange",
                        this.slideit.bind(this)
                    );
                }
                $(this.historyScrubber).slider("enable");
            }
            this.errLastRun = false;
            this.errinfo = "success";
        } catch (err) {
            if (!noUI) {
                $(this.historyScrubber).on(
                    "slidechange",
                    this.slideit.bind(this)
                );
                $(this.historyScrubber).slider("enable");
            }
            this.errinfo = err.toString();
            this.addErrorMessage(err);
        } finally {
            $(this.runButton).removeAttr("disabled");
            if (typeof window.allVisualizers != "undefined") {
                $.each(window.allVisualizers, function (i, e) {
                    e.redrawConnectors();
                });
            }
        }
    }

    disableInteraction() {
        $(this.runButton).hide();
        $(this.codeDiv).addClass("ac-disabled");
    }
}

var languageExtensions = {
    python: "py",
    html: "html",
    javascript: "js",
    java: "java",
    python2: "py",
    python3: "py",
    cpp: "cpp",
    c: "c",
    sql: "sql",
    octave: "m",
};

var errorText = {};

errorText.ParseError = $.i18n("msg_sctivecode_parse_error");
errorText.ParseErrorFix = $.i18n("msg_sctivecode_parse_error_fix");
errorText.TypeError = $.i18n("msg_activecode_type_error");
errorText.TypeErrorFix = $.i18n("msg_activecode_type_error_fix");
errorText.NameError = $.i18n("msg_activecode_name_error");
errorText.NameErrorFix = $.i18n("msg_activecode_name_error_fix");
errorText.ValueError = $.i18n("msg_activecode_value_error");
errorText.ValueErrorFix = $.i18n("msg_activecode_value_error_fix");
errorText.AttributeError = $.i18n("msg_activecode_attribute_error");
errorText.AttributeErrorFix = $.i18n("msg_activecode_attribute_error_fix");
errorText.TokenError = $.i18n("msg_activecode_token_error");
errorText.TokenErrorFix = $.i18n("msg_activecode_token_error_fix");
errorText.TimeLimitError = $.i18n("msg_activecode_time_limit_error");
errorText.TimeLimitErrorFix = $.i18n("msg_activecode_time_limit_error_fix");
errorText.Error = $.i18n("msg_activecode_general_error");
errorText.ErrorFix = $.i18n("msg_activecode_general_error_fix");
errorText.SyntaxError = $.i18n("msg_activecode_syntax_error");
errorText.SyntaxErrorFix = $.i18n("msg_activecode_syntax_error_fix");
errorText.IndexError = $.i18n("msg_activecode_index_error");
errorText.IndexErrorFix = $.i18n("msg_activecode_index_error_fix");
errorText.URIError = $.i18n("msg_activecode_uri_error");
errorText.URIErrorFix = $.i18n("msg_activecode_uri_error_fix");
errorText.ImportError = $.i18n("msg_activecode_import_error");
errorText.ImportErrorFix = $.i18n("msg_activecode_import_error_fix");
errorText.ReferenceError = $.i18n("msg_activecode_reference_error");
errorText.ReferenceErrorFix = $.i18n("msg_activecode_reference_error_fix");
errorText.ZeroDivisionError = $.i18n("msg_activecode_zero_division_error");
errorText.ZeroDivisionErrorFix = $.i18n(
    "msg_activecode_zero_division_error_fix"
);
errorText.RangeError = $.i18n("msg_activecode_range_error");
errorText.RangeErrorFix = $.i18n("msg_activecode_range_error_fix");
errorText.InternalError = $.i18n("msg_activecode_internal_error");
errorText.InternalErrorFix = $.i18n("msg_activecode_internal_error_fix");
errorText.IndentationError = $.i18n("msg_activecode_indentation_error");
errorText.IndentationErrorFix = $.i18n("msg_activecode_indentation_error_fix");
errorText.NotImplementedError = $.i18n("msg_activecode_not_implemented_error");
errorText.NotImplementedErrorFix = $.i18n(
    "msg_activecode_not_implemented_error_fix"
);
errorText.KeyError = $.i18n("msg_activecode_key_error");
errorText.KeyErrorFix = $.i18n("msg_activecode_key_error_fix");
errorText.AssertionError = $.i18n("msg_activecode_assertion_error");
errorText.AssertionErrorFix = $.i18n("msg_activecode_assertion_error_fix");

String.prototype.replaceAll = function (target, replacement) {
    return this.split(target).join(replacement);
};
