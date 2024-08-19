var Tracer = function (config) {
    // Call Initialization on Tracer Call
    this.init(config);
};



Tracer.prototype = {

    // Initialization
    init: async function (config) {

        var tracer = this;
        tracer.baseUrlEndpoint = 'https://app.visitortracking.com/api/vtservice/v1/'
            tracer.enabled = true;
        tracer.checkSessionValidaity();

        if (Object.keys(config).length === 0) {
            tracer.enabled = false;
            alert("Please set websiteId in config.")
            tracer.log("no config provided. using default..", '');
        }
        else if (!config.hasOwnProperty('websiteId')) {
            tracer.enabled = false;
            alert("Please set websiteId in config.")
        }
        else if (config.hasOwnProperty('websiteId')
            && (config.websiteId === null || config.websiteId === undefined || config.websiteId === '')) {
            tracer.enabled = false;
            alert("Please set websiteId in config.")
        }
        tracer.log('calling')
        await tracer.getTraceStatus(config.websiteId);

        // Argument Assignment          // Type Checks    
        tracer.websiteId = typeof (config.websiteId) == "string" ? config.websiteId : '',                                                           // Default Values
            tracer.events = Array.isArray(config.Events) === true ? config.Events : ['mouseup', 'touchend', 'keydown', 'scroll', 'mousemove', 'focus'], //
            tracer.endpoint = 'visitor/trace',
            tracer.async = typeof (config.async) == "boolean" ? config.async : true,
            tracer.debug = typeof (config.debug) == "boolean" ? config.debug : true,
            tracer.trace = { session: {}, visitor: {}, conversions: null },

            tracer.timeStamp = new Date(),
            tracer.navigationProcessTimer = 2, //in seconds
            tracer.navigationInterval = 0,
            tracer.sessionIdleTimer = 0;
        tracer.sessionInterval = 30, //in minutes
            tracer.idleTimer = 0,
            tracer.idleInterval = 5, //in minutes

            tracer.prevUrl = window.location.href, //undefined
            tracer.currUrl = window.location.href; //undefined
        tracer.isRedirect = false;
        tracer.sendEventConversion = false;

        // Trace only if trace is true
        if (tracer.enabled === true) {
            tracer.log('inside')
            // Initialize Visitor
            tracer.initVisitor();

            // Call Event Binding Method
            tracer.bindEvents();

            // Send trace
            tracer.sendTrace();

            // Navigation Change
            tracer.navigationChange();
        }

        return tracer;
    },

    // Generate Session Object & Assign to Session Property
    initVisitor: function () {
        var tracer = this;

        // Assign Visitor Property
        tracer.trace.visitor = {
            externalReferenceId: tracer.websiteId,
            pseudoId: tracer.visitorId(),
            pseudoName: tracer.visitorName(),
        }

        // Initialize Session
        tracer.initSession();

        return tracer;
    },

    // Generate Session Object & Assign to Session Property
    initSession: function () {
        var tracer = this;

        // Assign Session Property
        tracer.trace.session = {
            websiteId: 0,
            jSessionId: tracer.sessionId(),
            browser: tracer.browserName(),
            device: tracer.isMobile() ? 'Mobile' : tracer.isMobileTablet() ? 'Tablet' : 'Desktop',
            operatingSystem: tracer.osName(),
            source: document.referrer,
            resolution: (window.screen.width * window.devicePixelRatio + "x" + window.screen.height * window.devicePixelRatio),
            isActive: true,
            page: {
                pageUrl: window.location.href,
                pageTitle: document.title,
                jSessionId: tracer.sessionId(),
                interaction: null,
                scrollPercentage: tracer.scrollDepth,
            },
            endpoint: tracer.endpoint
        };

        //Init Conversion
        tracer.initConversionData(tracer.conversions);

        //Set conversion
        tracer.setConversionData(window.location.href);

        return tracer;
    },

    // Create Events to Track
    bindEvents: function () {
        var tracer = this;
        // Set Event Capture
        if (document.readyState !== 'loading') {
            tracer.attachEvents();
        } else {
            document.addEventListener("DOMContentLoaded", function () {
                tracer.attachEvents();
            });
        }

        window.addEventListener('beforeunload', (event) => {
            if (tracer.enabled == true && (tracer.currUrl == tracer.prevUrl)) {
                if (navigator.sendBeacon) {
                    tracer.trace.session.isActive = false;
                    tracer.resetSession();
                    tracer.resetIdealTime();

                    //Send trace
                    //const blob = new Blob([JSON.stringify(tracer.trace)], {type : 'application/json'});
                    let data = new FormData();
                    data.append('data', JSON.stringify(tracer.trace));
                    navigator.sendBeacon(tracer.baseUrlEndpoint + tracer.endpoint + '1', data);
                }
            }
        });

        /*window.addEventListener("visibilitychange", (event) => { 
            if(tracer.enabled == true && (tracer.currUrl == tracer.prevUrl)){
                if (navigator.sendBeacon) {
                    if (document.visibilityState === 'hidden') {
                        tracer.trace.session.isActive = false;
                    }
                    else {
                        tracer.trace.session.isActive = true;
                    }

                    tracer.resetSession();
                    tracer.resetIdealTime();

                    //Send trace
                    //const blob = new Blob([JSON.stringify(tracer.trace)], {type : 'application/json'});
                    let data = new FormData();
                    data.append('data', JSON.stringify(tracer.trace));
                    navigator.sendBeacon(tracer.baseUrlEndpoint + tracer.endpoint + '1', data);
                }
            }
        });*/

        return tracer;
    },

    attachEvents() {
        var tracer = this;
        tracer.events.forEach(function (e) {
            document.querySelector('body').addEventListener(e, function (event) {

                //If session is inactive then initilize session 
                if (!tracer.trace.session.isActive) {
                    tracer.initVisitor();
                }

                //check session time and reset if passed
                tracer.timeStamp = new Date();
                tracer.setEventConversion(e, event);
                if (e === "mouseup" || e === "touchend") {
                    if (event.target.nodeName === 'BUTTON') {
                        tracer.isRedirect = true;
                        //tracer.addEventTrace(event);
                    }
                    else if (event.target.nodeName === 'A') {
                        tracer.isRedirect = true;
                        //tracer.addEventTrace(event);
                    }
                }
                else if (e === "keydown") {

                }
                else if (e === "scroll") {

                }
                else if (e === "mousemove") {
                    tracer.resetSession();
                    tracer.resetIdealTime();
                }
                else if (e === "focus") {
                    tracer.resetSession();
                    tracer.resetIdealTime();
                }
            });
        });
    },

    // Add Interaction Object Triggered By Events to Records Array
    addEventTrace: function (e) {

        var tracer = this,

            // UI-Interaction Object
            interaction = {
                event: e.type,
                targetTag: e.target?.nodeName,
                targetId: e.target?.id,
                targetClasses: e.target?.className,
                content: e.target?.innerText,
                clientPosition: {
                    x: e.clientX,
                    y: e.clientY
                },
                screenPosition: {
                    x: e.screenX,
                    y: e.screenY
                },
                createdDate: new Date()
            };

        // Insert into Records Array
        //tracer.records.push(interaction);

        tracer.log('addEventTrace', tracer.trace);

        if (tracer.trace && tracer.trace.session && tracer.trace.session.page) {
            tracer.trace.session.page.interaction = interaction;

            // Send data
            tracer.sendTrace();
        }

        return tracer;
    },

    navigationChange: function () {
        var tracer = this;

        clearInterval(tracer.navigationInterval); //reset the previous timer
        tracer.navigationInterval = setInterval(function () {

            tracer.currUrl = window.location.href;
            if (tracer.currUrl != tracer.prevUrl) {
                tracer.isRedirect = false;
                // URL changed
                tracer.prevUrl = tracer.currUrl;

                // Log currUrl if Debugging
                tracer.log('URL changed to', tracer.currUrl);

                //Initilize page when page is changed
                if (tracer.trace && tracer.trace.session) {
                    tracer.trace.session.page = {
                        pageUrl: window.location.href,
                        pageTitle: document.title,
                        jSessionId: tracer.sessionId(),
                        interaction: null
                    };
                }

                //Set conversion
                tracer.setConversionData(window.location.href);

                // Send data
                tracer.sendTrace();
            }
        }, tracer.navigationProcessTimer * 1000);

        return tracer;
    },

    resetIdealTime: function () {
        var tracer = this;

        clearTimeout(tracer.idleTimer); //reset the previous timer
        tracer.idleTimer = setTimeout(function () { //set another one right away

            tracer.log('Ideal timer', tracer.trace);

            tracer.trace.session.isActive = false;

            //Send trace
            tracer.sendTrace();

        }, tracer.idleInterval * 60 * 1000); //idleInterval minutes

        return tracer;
    },

    resetSession: function () {
        /*
        Initilize session in init and send initial trace
        Update session active status and end-time every 10 sec
        If there is a sessionDuration time out in between close session will update the status and stop the 10 sec timer
        On any event i.e. mousemove, scroll, focus initilize the ideal timer as well as 10 sec timer.
        */
        var tracer = this;

        clearTimeout(tracer.sessionIdleTimer); //reset the previous timer
        tracer.sessionIdleTimer = setTimeout(function () { //set another one right away

            tracer.log('closeSession', tracer.trace);

            tracer.trace.session.isActive = false;

            //Send trace
            tracer.sendTrace();

            localStorage.removeItem("VTSessionId");
            localStorage.removeItem("VTSessionTime");
            localStorage.removeItem("VTConversion");

        }, tracer.sessionInterval * 60 * 1000); //sessionInterval minutes

        return tracer;
    },

    // Gather Additional Data and Send Trace to Server
    // sendTrace: function () {

    //     var tracer  = this;
    //     // Initialize Cross Header Request
    //     if(tracer.enabled === true){

    //         var xhr = new XMLHttpRequest();
    //         xhr.onreadystatechange = function() {
    //             if (this.readyState == 4) {
    //                 if(this.status == 200){
    //                     let data;
    //                     try {
    //                         data = JSON.parse(this.responseText);
    //                     } catch (e) {}
    //                     if(typeof(data) === 'object' && data != null && data.hasOwnProperty('trace')){
    //                         tracer.enabled = data.trace; 
    //                     }
    //                 }
    //                 else if(this.status == 400){
    //                     let data;
    //                     try {
    //                         data = JSON.parse(this.responseText);
    //                     } catch (e) {}
    //                     if(typeof(data) === 'object' && data != null && data.hasOwnProperty('trace')){
    //                         tracer.enabled = data.trace;
    //                     }
    //                 }
    //             }
    //         };

    //         tracer.log('sendTrace',{obj: tracer.trace, obj1: tracer.async});

    //         if(tracer.isEmptyObject(tracer.trace.conversions)){
    //             tracer.trace.conversions = [];
    //         }

    //         // Post Session Data Serialized as JSON
    //         xhr.open('POST', tracer.baseUrlEndpoint + tracer.endpoint, tracer.async);
    //         xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
    //         xhr.send(JSON.stringify(tracer.trace));

    //     }

    //     return tracer;
    // },

    sendTrace: async function () {
        var tracer = this;
        if (tracer.enabled === true) {
            tracer.log('sendTrace new', tracer.trace);
            if (tracer.isEmptyObject(tracer.trace.conversions)) {
                tracer.trace.conversions = [];
            }

            try {
                const response = await fetch(tracer.baseUrlEndpoint + tracer.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8'
                    },
                    body: JSON.stringify(tracer.trace)
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok.');
                }

                const data = await response.json();
                if (data && data.hasOwnProperty('trace')) {
                    tracer.enabled = data.trace;
                }
            } catch (error) {
                tracer.log('sendTrace error', error);
            }
        }

        return tracer;
    },

    // Check if website is active for trace
    // getTraceStatus: function (websiteId) {
    //     var tracer = this;
    //     var xhr = new XMLHttpRequest();
    //     xhr.onreadystatechange = function () {
    //         if (this.readyState == 4) {
    //             if (this.status == 200) {
    //                 let data;
    //                 try {
    //                     data = JSON.parse(this.responseText);
    //                 } catch (e) { }

    //                 if (typeof (data) === 'object' && data != null && data.hasOwnProperty('trace')) {
    //                     tracer.enabled = data.trace.isActive;
    //                     tracer.conversions = data.trace.conversions;
    //                 }
    //             }
    //             else {
    //                 tracer.enabled = false;
    //             }
    //         }

    //     };
    //     xhr.open('GET', tracer.baseUrlEndpoint + 'website/getsite?id=' + websiteId, false);
    //     xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
    //     xhr.send();
    //     return tracer;
    // },

    getTraceStatus: async function (websiteId) {
        var tracer = this;

        var url = tracer.baseUrlEndpoint + 'website/getsite?id=' + websiteId;

        await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8'
            },
            // Setting the 'credentials' option to 'same-origin' can help with certain types of CORS issues
            credentials: 'same-origin'
        })
            .then(function (response) {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error('Network response was not ok.');
                }
            })
            .then(function (data) {
                if (data && data.hasOwnProperty('trace')) {
                    tracer.enabled = data.trace.isActive;
                    tracer.conversions = data.trace.conversions;
                }
            })
            .catch(function (error) {
                tracer.enabled = false;
                tracer.log('sendTrace error', error);
            });

        return tracer;
    },


    setEventConversion: function (e, event) {
        var tracer = this;
        var _conversionData = tracer.getConversionData();
        if (_conversionData != null) {
            _conversionData.forEach(element => {
                //Process Events here
                var _pageUrl = window.location.href;
                if (element.type == 'Event') {
                    var elemSelector = tracer.generateQuerySelector(event.target);
                    if (e === "mouseup" || e === "touchend" && element.condition == 'click/press') {
                        if (element.isComplete != true) {
                            //event.target.matches
                            if (event.target.closest(trimDotFromEnd(element.eventSelector)) && _pageUrl.toLowerCase().includes(element.pageUrl.toLowerCase())) {
                                element.isComplete = true;
                                tracer.sendEventConversion = true;
                            }
                            /*if(element.eventSelector == elemSelector && _pageUrl.toLowerCase().includes(element.pageUrl.toLowerCase())){
                                element.isComplete = true;
                                tracer.sendEventConversion = true;
                            }*/
                        }
                    }
                    else if (e === "focus" && element.condition == 'focus') {
                        if (element.isComplete != true) {
                            if (event.target.closest(trimDotFromEnd(element.eventSelector)) && _pageUrl.toLowerCase().includes(element.pageUrl.toLowerCase())) {
                                element.isComplete = true;
                                tracer.sendEventConversion = true;
                            }
                            /*if(element.eventSelector == elemSelector && _pageUrl.toLowerCase().includes(element.pageUrl.toLowerCase())){
                                element.isComplete = true;
                                tracer.sendEventConversion = true;
                            }*/
                        }
                    }
                    else if (e === "submit" && element.condition == 'submit') {
                        if (element.isComplete != true) {
                            if (event.target.closest(trimDotFromEnd(element.eventSelector)) && _pageUrl.toLowerCase().includes(element.pageUrl.toLowerCase())) {
                                element.isComplete = true;
                                tracer.sendEventConversion = true;
                            }
                            /*if(element.eventSelector == elemSelector && _pageUrl.toLowerCase().includes(element.pageUrl.toLowerCase())){
                                element.isComplete = true;
                                tracer.sendEventConversion = true;
                            }*/
                        }
                    }
                }
            });

            //Set to localstorage after processing
            localStorage.setItem("VTConversion", JSON.stringify(_conversionData));
            tracer.trace.conversions = _conversionData;

            if (tracer.sendEventConversion) {
                tracer.addEventTrace(event);
                tracer.sendEventConversion = false;
            }
        }
    },

    generateQuerySelector(el) {
        if (el.tagName.toLowerCase() == "html")
            return "HTML";
        var str = el.tagName;
        str += (el.id != "") ? "#" + el.id : "";
        if (el.className) {
            var classes = [];
            if (typeof el.className == "string") {
                classes = el.className.split(/\s/);
                for (var i = 0; i < classes.length; i++) {
                    if (classes[i] != null && classes[i] != '') {
                        str += "." + classes[i]
                    }
                }
            }
        }
        return str
    },

    browserName: function () {
        var tracer = this;
        var browserName = 'other';
        (function (agent) {
            switch (true) {
                case tracer.isBrave(): browserName = "Brave"; break;
                case agent.indexOf("yabrowser") > -1: browserName = "Yandex"; break;
                case agent.indexOf("edge") > -1: browserName = "MS Edge"; break;
                case agent.indexOf("edg/") > -1: browserName = "Edge ( chromium based)"; break;
                case agent.indexOf("opr") > -1 && !!window.opr: browserName = "Opera"; break;
                case agent.indexOf("chrome") > -1 && !!window.chrome: browserName = "Chrome"; break;
                case agent.indexOf("trident") > -1: browserName = "MS IE"; break;
                case agent.indexOf("firefox") > -1: browserName = "Mozilla Firefox"; break;
                case agent.indexOf("safari") > -1: browserName = "Safari"; break;
                default: break;
            }
        })(window.navigator.userAgent.toLowerCase());
        return browserName;
    },

    osName: function () {
        var userAgent = window.navigator.userAgent,
            platform = window.navigator?.userAgentData?.platform || window.navigator?.platform,
            macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K', 'macOS'],
            windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'],
            iosPlatforms = ['iPhone', 'iPad', 'iPod'],
            os = 'unknown';

        if (macosPlatforms.indexOf(platform) !== -1 || platform.toUpperCase().indexOf('MAC') >= 0) {
            os = 'Mac OS';
        } else if (iosPlatforms.indexOf(platform) !== -1) {
            os = 'iOS';
        } else if (windowsPlatforms.indexOf(platform) !== -1) {
            os = 'Windows';
        } else if (/Android/.test(userAgent)) {
            os = 'Android';
        } else if (/Linux/.test(platform)) {
            os = 'Linux';
        }

        return os;
    },

    isMobile: function () {
        var check = false;
        (function (a) {
            if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4)))
                check = true;
        })(navigator.userAgent || navigator.vendor || window.opera);
        return check;
    },

    isMobileTablet: function () {
        var check = false;
        (function (a) {
            if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4)))
                check = true;
        })(navigator.userAgent || navigator.vendor || window.opera);
        return check;
    },
    isBrave: function () {
        if (window.navigator.brave != undefined) {
            if (window.navigator.brave.isBrave.name == "isBrave") {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    },
    generateId: function (stringLength = 20) {
        /*let randomStr = "";
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZqeytrpolkadjsghfgmnbzxcvnQPOWEYRKASJHDGFMNBCVX--___-_jsfhrlg-_124903564576986483658fgh4sdfh687e4h897WETHJ68F7G4688471877GFHJFFGJ87469857468746hfghwrtiyj4598yhdjkhgnk";
        for (let index = 0; index < stringLength; index++) {
            randomStr += characters.charAt(
            Math.floor(Math.random() * characters.length)
            );
        }
        return randomStr;*/

        // Get current timestamp in milliseconds
        const timestamp = new Date().getTime().toString();

        // Generate random string
        const randomString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        // Combine timestamp and random string to create unique ID
        const uniqueId = timestamp + randomString;

        // Make sure ID is exactly 50 characters by truncating or padding with zeroes as needed
        return uniqueId.padEnd(50, '0').substring(0, 50);
    },

    visitorId: function () {
        var tracer = this;
        if (localStorage.getItem("VTVisitiorId")) {
            return localStorage.getItem("VTVisitiorId");
        }
        else {
            let randomStr = tracer.generateId();
            localStorage.setItem("VTVisitiorId", randomStr);

            //if visitor id is created new create name too again
            localStorage.removeItem("VTVisitiorName");

            return randomStr;
        }
    },

    visitorName: function () {
        if (localStorage.getItem("VTVisitiorName")) {
            return localStorage.getItem("VTVisitiorName");
        }
        else {
            var adjs = ["Autumn", "Hidden", "Bitter", "Misty", "Silent", "Empty", "Dry",
                "Dark", "Summer", "Icy", "Delicate", "Quiet", "White", "Cool", "Spring",
                "Winter", "Patient", "Twilight", "Dawn", "Crimson", "Wispy", "Weathered",
                "Blue", "Billowing", "Broken", "Cold", "Damp", "Falling", "Frosty", "Green",
                "Long", "Late", "Lingering", "Bold", "Little", "Morning", "Muddy", "Old",
                "Red", "Rough", "Still", "Small", "Sparkling", "Throbbing", "Shy",
                "Wandering", "Withered", "Wild", "Black", "Young", "Holy", "Solitary",
                "Fragrant", "Aged", "Snowy", "Proud", "Floral", "Restless", "Divine",
                "Polished", "Ancient", "Purple", "Lively", "Nameless"]

                , nouns = ["Waterfall", "River", "Breeze", "Moon", "Rain", "Wind", "Sea",
                    "Morning", "Snow", "Lake", "Sunset", "Pine", "Shadow", "Leaf", "Dawn",
                    "Glitter", "Forest", "Hill", "Cloud", "Meadow", "Sun", "Glade", "Bird",
                    "Brook", "Butterfly", "Bbush", "Dew", "Dust", "Field", "Fire", "Flower",
                    "Firefly", "Feather", "Grass", "Haze", "Mountain", "Night", "Pond",
                    "Darkness", "Snowflake", "Silence", "Sound", "Sky", "Shape", "Surf",
                    "Thunder", "Violet", "Water", "Wildflower", "Wave", "Water", "Resonance",
                    "Sun", "Wood", "Dream", "Cherry", "Tree", "Fog", "Frost", "Voice", "Paper",
                    "Frog", "Smoke", "Star"];

            var visitorName = adjs[Math.floor(Math.random() * (adjs.length - 1))] + " " + nouns[Math.floor(Math.random() * (nouns.length - 1))];

            localStorage.setItem("VTVisitiorName", visitorName);
            return visitorName;
        }
    },

    sessionId: function (stringLength = 20) {
        var tracer = this;
        if (localStorage.getItem("VTSessionId")) {
            return localStorage.getItem("VTSessionId");
        }
        else {
            localStorage.removeItem("VTConversion");
            this.initConversionData(tracer.trace.conversions);
            let randomStr = tracer.generateId();
            localStorage.setItem("VTSessionId", randomStr);
            localStorage.setItem("VTSessionTime", new Date());
            return randomStr;
        }
    },

    minutesDiff: function (dateTimeValue2, dateTimeValue1) {
        var differenceValue = (dateTimeValue2.getTime() - dateTimeValue1.getTime()) / 1000;
        differenceValue /= 60;
        return Math.abs(Math.round(differenceValue));
    },

    log: function (key, message) {
        tracer = this;
        // Log Interaction if Debugging
        if (tracer.debug) {
            // Log to Console
            console.log(key + ":\n", message);
        }
    },

    checkSessionValidaity: function () {
        if (localStorage.getItem("VTSessionTime")) {
            var VTSessionTime = Date.parse(localStorage.getItem("VTSessionTime"));
            var duration = this.minutesDiff(new Date(), new Date(VTSessionTime));
            if (30 <= duration) {
                localStorage.removeItem("VTSessionId");
                localStorage.removeItem("VTSessionTime");
            }
        }
        else {
            localStorage.removeItem("VTSessionId");
            localStorage.removeItem("VTSessionTime");
        }
    },

    initConversionData: function (conversionData) {
        var tracer = this;
        if (!tracer.isEmptyObject(conversionData)) {
            tracer.trace.conversions = conversionData;
            //localStorage.setItem("VTConversion",JSON.stringify(tracer.trace.conversions));
            var localConversions = tracer.trace.conversions;
            if (localConversions != null && localConversions != undefined) {
                var _conversionData = tracer.getConversionData();
                if (_conversionData != null) {
                    localConversions.forEach(element => {
                        var itemLocal = _conversionData.find(x => x.id == element.id);
                        if (itemLocal) {
                            element.isComplete = itemLocal.isComplete;
                            if (element.funnel) {
                                element.funnel.forEach(step => {
                                    var localStep = itemLocal.funnel.find(y => y.id == step.id);
                                    if (localStep) {
                                        step.isComplete = localStep.isComplete;
                                    }
                                })
                            }
                        }
                    });
                    tracer.trace.conversions = localConversions;
                    localStorage.setItem("VTConversion", JSON.stringify(localConversions));
                }
                else {
                    localStorage.setItem("VTConversion", JSON.stringify(tracer.trace.conversions));
                }
            }
            else {
                localStorage.setItem("VTConversion", JSON.stringify(tracer.trace.conversions));
            }
        }
    },

    setConversionData(pageUrl) {
        var tracer = this;
        var _conversionData = tracer.getConversionData();
        if (_conversionData != null) {
            _conversionData.forEach(element => {
                //If its a conversion not Funnel process here
                if (element.type == 'PageVisited' && element.isComplete != true) {
                    if (element.condition.toLowerCase() == "contains") {
                        element.isComplete = pageUrl.toLowerCase().includes(element.pageUrl.toLowerCase());
                    }
                    else if (element.condition.toLowerCase() == "exact") {
                        if (element.pageUrl.startsWith('*')) {
                            element.isComplete = pageUrl.toLowerCase().includes(element.pageUrl.toLowerCase().replaceAll("/*/g", ""));
                        } else if (element.pageUrl.endsWith('*')) {
                            element.isComplete = pageUrl.toLowerCase().includes(element.pageUrl.toLowerCase().replaceAll("/*/g", ""));
                        }
                        else {
                            element.isComplete = (pageUrl.toLowerCase() == element.pageUrl.toLowerCase());
                        }
                    }
                }

                //Process Funnel here
                if (element.type == 'EntireFunnel' && element.funnel != null && element.funnel.length > 0) {
                    var nextStep = tracer.getFunnelNextStep(element.funnel);
                    if (nextStep != null) {
                        if (nextStep.isComplete != true) {
                            if (nextStep.condition.toLowerCase() == "contains") {
                                nextStep.isComplete = pageUrl.toLowerCase().includes(nextStep.value.toLowerCase());
                            }
                            else if (nextStep.condition.toLowerCase() == "exact") {
                                if (nextStep.value.startsWith('*')) {
                                    nextStep.isComplete = pageUrl.toLowerCase().includes(nextStep.value.toLowerCase().replaceAll("/*/g", ""));
                                } else if (nextStep.value.endsWith('*')) {
                                    nextStep.isComplete = pageUrl.toLowerCase().includes(nextStep.value.toLowerCase().replaceAll("/*/g", ""));
                                }
                                else {
                                    nextStep.isComplete = (pageUrl.toLowerCase() == nextStep.value.toLowerCase());
                                }
                            }
                        }
                    }

                    // element.funnel.forEach(step => {
                    //     if(step.isComplete != true){
                    //         if(step.condition.toLowerCase() == "contains"){
                    //             step.isComplete = pageUrl.toLowerCase().includes(step.value.toLowerCase());
                    //         }
                    //         else if(step.condition.toLowerCase() == "exact"){
                    //             if(step.value.startsWith('*')){
                    //                 step.isComplete = pageUrl.toLowerCase().includes(step.value.toLowerCase().replaceAll("/*/g",""));
                    //             } else if(step.value.endsWith('*')){
                    //                 step.isComplete = pageUrl.toLowerCase().includes(step.value.toLowerCase().replaceAll("/*/g",""));
                    //             }
                    //             else{
                    //                 step.isComplete = (pageUrl.toLowerCase() == step.value.toLowerCase());
                    //             }
                    //         }
                    //     }
                    // });

                    //Set funnel percent complete
                    var totalStepsInFunnel = element.funnel.length;
                    var totalCompletedSteps = element.funnel.filter(x => x.isComplete == true).length;
                    element.isComplete = (totalStepsInFunnel === totalCompletedSteps);
                }
            });

            //Set to localstorage after processing
            localStorage.setItem("VTConversion", JSON.stringify(_conversionData));
            tracer.trace.conversions = _conversionData;
        }
    },

    getConversionData() {
        var tracer = this;
        var _conversionData = localStorage.getItem("VTConversion");
        if (_conversionData && _conversionData != "undefined") {
            var dataObject = JSON.parse(_conversionData);;
            if (!tracer.isEmptyObject(dataObject)) {
                return dataObject;
            }
            else {
                return null;
            }
        }
        else {
            return null;
        }
    },

    getFunnelNextStep(funnelData) {
        let nextStep = null;
        for (let step of funnelData) {
            if (step.isComplete == false) {
                return step;
            }
        }

        if (funnelData.length > 0) {
            nextStep = funnelData[0];
        }
        return nextStep;
    },

    isEmptyObject(obj) {
        for (var prop in obj) {
            if (typeof Object.hasOwn === "function") {
                if (Object.hasOwn(obj, prop)) {
                    return false;
                }
            }
            else {
                if (Object.prototype.hasOwnProperty.call(obj, prop)) {
                    return false;
                }
            }
        }

        return true;
    },

    setCookie(cname, cvalue, exdays) {
        const d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        let expires = "expires=" + d.toUTCString();
        document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    },

    getCookie(cname) {
        let name = cname + "=";
        let ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name) == 0) {
                return c.substring(name.length, c.length);
            }
        }
        return "";
    }
};

try {
    setTimeout(() => {
        init_tracer();
    }, 200);
} catch (err) { console.log(err) }

function bindEvent(element, eventName, eventHandler) {
    if (element.addEventListener) {
        element.addEventListener(eventName, eventHandler, false);
    } else if (element.attachEvent) {
        element.attachEvent('on' + eventName, eventHandler);
    }
}

function sendMessageToParent(msg) {
    // Send a message to the parent
    // Make sure you are sending a string, and to stringify JSON
    window.parent.postMessage(msg, '*'); //comment this when using prod and use below
    //window.parent.postMessage(msg, 'https://app.visitortracking.com/');
}

bindEvent(window, 'message', function (e) {
    if (e.data == 'APE') {
        document.addEventListener("click", function (event) {
            if (!event.shiftKey) {
                event.preventDefault();
                event.stopPropagation();
                var elem = event.target;
                //var elem = document?.elementFromPoint(event.clientX, event.clientY);
                if (elem != null) {
                    var qStr = generateQuerySelector(elem);
                    sendMessageToParent(JSON.stringify({ 'caller': 'vtevent01', 'selector': qStr }));
                }
            }
        });

        document.addEventListener('mouseover', function (e) {
            mouseoverHighlight(e);
        }, false);

        document.addEventListener('mouseout', function (e) {
            mouseoutUnHighlight(e);
        }, false);
    }
})

function generateQuerySelector(el) {
    if (el.tagName.toLowerCase() == "html")
        return "HTML";
    var str = el.tagName;
    str += (el.id != "") ? "#" + el.id : "";
    if (el.className) {
        var classes = [];
        if (typeof el.className == "string") {
            classes = el.className.split(/\s/);
            for (var i = 0; i < classes.length; i++) {
                if (classes[i] != null && classes[i] != '') {
                    str += "." + classes[i]
                }
            }
        }
    }
    return str
}

function mouseoverHighlight(e) {
    /* if hovered node is NOT the registered  || event listener...  */
    if (e.target !== e.currentTarget) {
        // Reference hovered element
        var tgt = e.target;
        tgt.style.outline = '4px solid yellow';

        // Stop the bubbling phase
        e.stopPropagation();
    }
}

function mouseoutUnHighlight(e) {
    if (e.target !== e.currentTarget) {
        var tgt = e.target;
        tgt.style.outline = '0 none transparent';
    }
    e.stopPropagation();
}

function trimDotFromEnd(str) {
    return str.replace(/\.*$/, '');
}

bindEvent(window, "scroll", function (e) {
    var animateScroll = () => {
        var tracer = this;
        var maxScrollPercentage = 0;
        var scrollHeight = document.documentElement.scrollHeight;
        var scrollTop = window.scrollY;
        var windowHeight = window.innerHeight;
        var scrollPercentage = Math.round(
            ((scrollTop + windowHeight) / scrollHeight) * 100
        );
        // console.log("tracer object", tracer?.tracer?.trace);
        if (tracer?.tracer && tracer.tracer?.trace && tracer.tracer?.trace?.session && tracer.tracer?.trace?.session?.page) {
            if (sessionStorage.getItem("max") != null || sessionStorage.getItem("max") != undefined) {
                if (scrollPercentage > sessionStorage.getItem("max")) {
                    maxScrollPercentage = scrollPercentage;
                    sessionStorage.setItem("max", maxScrollPercentage);
                    console.log("new max:", typeof (maxScrollPercentage))
                    tracer.tracer.trace.session.page.scrollPercentage = maxScrollPercentage;
                }
                else {
                    sessionStorage.setItem("max", scrollPercentage);
                    tracer.tracer.trace.session.page.scrollPercentage = scrollPercentage;
                }
            }
            else {
                sessionStorage.setItem("max", scrollPercentage);
                tracer.tracer.trace.session.page.scrollPercentage = scrollPercentage;
            }
        }

        // requestAnimationFrame(animateScroll);
    };
    animateScroll();
});
