var websocket;

class WebsocketWrapper {
    constructor(url) {
        this.socket = new WebSocket(url);
        this.messageQueue = [];

        this.socket.addEventListener('message', (event) => {
            const resolver = this.messageQueue.shift();
            if (resolver) {
                resolver(event.data);
            }
        });
    }

    async nextMessage() {
        return new Promise((resolve) => {
            this.messageQueue.push(resolve);
        });
    }

    async send(data) {
        const promise = this.nextMessage();
        this.socket.send(data);
        return await promise;
    }

    async open() {
        return new Promise((resolve) => {
            this.socket.addEventListener('open', () => {
                resolve();
            });
        });
    }
}

async function sql_exec(sql) {
    const username = sessionStorage.getItem("username");
    const password = sessionStorage.getItem("password");
    if (!websocket) {
        websocket = new WebsocketWrapper(`wss://${window.location.hostname}:${window.location.port}/database`);
        await websocket.open();
        let payload = JSON.stringify({ database: database, username: username, password: password, sql: "SET ROLE ALL;" });
        await websocket.send(payload);
    }
    let payload = JSON.stringify({ database: database, username: username, password: password, sql: sql });
    let result = await websocket.send(payload);
    return JSON.parse(result);
}

async function get_schema(proc_name) {
    let result = await sql_exec(`CALL inspectProcedure("${proc_name}");`);
    // Get rid of the column names
    result[0].shift();
    return result[0];
}

async function call_procedure(proc_name) {
    let result = await sql_exec(`CALL ${proc_name};`);
    // Get rid of the column names
    result[0].shift();
    return result[0];
}

async function get_routines() {
    return await call_procedure("listRoutines");
}

// Transform a camelCase (or StudlyCase) word into a sentence with spaces and
// uniform capitalization
function make_pretty(inputStr) {
  if (inputStr.length === 0) {
    return inputStr;
  }

  if (inputStr[0] == '@') {
      inputStr = inputStr.slice(1);
  }
  if (inputStr[0] == '_') {
      inputStr = inputStr.slice(1);
  }

  let formattedStr = inputStr[0].toUpperCase();

  for (let i = 1; i < inputStr.length; i++) {
    if (inputStr[i] === inputStr[i].toUpperCase() && inputStr[i] !== ' ') {
      formattedStr += ' ';
    }
    formattedStr += inputStr[i];
  }

  return formattedStr;
}

// Replace an single quotes with a pair of single quotes
function sql_escape(input) {
    return input.replace(/'/g, "''");
}

async function submit_form(proc_name, format_row, prev_proc, after_results) {
    var proc_info = await get_schema(proc_name);

    var sql = `CALL ${proc_name}(`;

    var first = true;
    var have_output = false;

    if (prev_proc == undefined) {
        prev_proc = proc_name;
    }

    for (const e of proc_info) {
        if (!first) {
            sql += ',';
        }
        first = false;

        if (e[0] == "IN") {
            // Remove leading underscore, if any
            var input_name = e[1];
            if (input_name[0] == '_') {
                input_name = input_name.slice(1);
            }
            if (input_name.includes('_')) {
                const parts = input_name.split('_');
                input_name = parts[1];
            }

            if (e[1] == "paginate_offset") {
                const offset = document.querySelector("#pagination_offset").value;
                sql += offset;
            } else if (e[1] == "paginate_count") {
                const count = document.querySelector("#pagination_count").value;
                sql += count;
            } else {
                var elem = document.querySelector(`#${prev_proc}_${input_name}`);
                var value = sql_escape(elem.value);
                if (elem.getAttribute('type') == 'checkbox') {
                    if (elem.checked) {
                        value = 1;
                    } else {
                        value = 0;
                    }
                    sql += `'${value}'`;
                } else {
                    if (e[1] != 'char' && e[1] != 'varchar' && value == '') {
                        sql += 'NULL';
                    } else if (value == 'null') {
                        sql += 'NULL';
                    } else {
                        sql += `'${value}'`;
                    }
                }
            }
        } else {
            have_output = true;
            sql += '@' + e[1];
        }
    }
    sql += ');';

    if (have_output) {
        sql += ' SELECT ';
        var first = true;
        for (const e of proc_info) {
            if (e[0] == "OUT") {
                if (!first) {
                    sql += ',';
                }
                first = false;

                sql += '@' + e[1];
            }
        }
        sql += ';'
    }

    var results = document.querySelector(`#results_${proc_name}`);
    results.innerHTML = '';
    var all_result = await sql_exec(sql);

    var total_rows = 0;
    for (const result of all_result) {
        if (result[0] == '@paginate_total') {
            total_rows = parseInt(result[1]);
            continue;
        }

        var table = document.createElement('table');
        table.className = "table";

        var first = true;
        for (const row of result) {
            const tr = format_row(row, first, result[0]);
            if (tr) {
                table.appendChild(tr);
            }
            first = false;
        }
        results.appendChild(table);
    }

    // Add pagination controls
    if (total_rows > 0) {
        const ul = document.createElement('ul');
        ul.className = "pagination";
        results.appendChild(ul);

        const offset = parseInt(document.querySelector("#pagination_offset").value);
        const count = parseInt(document.querySelector("#pagination_count").value);
        const num_pages = parseInt((total_rows + count - 1) / count);

        for (let i=0; i<num_pages; i++) {
            const li = document.createElement('li');
            ul.appendChild(li);
            li.className="page-item";
            if (offset == i * count) {
                li.className += " active";
            }

            const a = document.createElement('a');
            li.appendChild(a);
            a.className = "page-link";
            a.textContent = i+1;
            a.addEventListener('click', (event) => {
                document.querySelector("#pagination_offset").value = i * count;
                submit_form(proc_name, format_row, prev_proc, after_results);
            });
        }
    }

    if (after_results) {
        after_results();
    }
}

function form_input(label, name, type, dbtype, dtd) {
    var div = document.createElement('div');
    div.className = "form-group";

    if (!type) {
	if (dtd == "tinyint(1)") {
	    type = "checkbox";
	} else {
	    type = "text";
	}
    }

    var p = document.createElement('label');
    p.setAttribute('for', name);
    p.textContent = label;
    div.appendChild(p);
    var input = document.createElement('input');
    input.className = "form-control";
    input.setAttribute('id', name);
    input.setAttribute('type', type);
    div.appendChild(input);

    if (dbtype == 'int') {
        input.addEventListener('input', (event) => {
            const regex = /^-?\d+$/;
            if (!regex.test(input.value)) {
                p.style.color = 'red';
            } else {
                p.style.color = 'black';
            }
        });
    } else if (dbtype == 'date') {
        input.addEventListener('input', (event) => {
            const regex = /^\d+-\d+-\d+$/;
            if (!regex.test(input.value)) {
                p.style.color = 'red';
            } else {
                p.style.color = 'black';
            }
        });
    } else if (dbtype == 'decimal') {
        const regex = /decimal\((\d+),(\d+)\)/;
        const match = regex.exec(dtd);
        if (match) {
            const precision = parseInt(match[1], 10);
            const scale = parseInt(match[2], 10);
            if (scale > 0) {
                const integerPart = precision - scale;
                var regexPattern = `^-?\\d{1,${integerPart}}(\\.\\d{1,${scale}})?$`;
            } else {
                const integerPart = precision;
                var regexPattern = `^-?\\d{1,${integerPart}}$`;
            }
            const regex = new RegExp(regexPattern);

            input.addEventListener('input', (event) => {
                if (!regex.test(input.value)) {
                    p.style.color = 'red';
                } else {
                    p.style.color = 'black';
                }
            });
        }
    } else if (dbtype == 'float') {
        input.addEventListener('input', (event) => {
            const regex = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;
            if (!regex.test(input.value)) {
                p.style.color = 'red';
            } else {
                p.style.color = 'black';
            }
        });
    }

    return div;
}

function form_select(label, name, options) {
    const div = document.createElement('div');
    div.className = "form-group";

    const p = document.createElement('label');
    div.appendChild(p);
    p.setAttribute('for', name);
    p.textContent = label;

    const input = document.createElement('select');
    div.appendChild(input);
    input.className = "form-control";
    input.setAttribute('id', name);

    for (const i of options) {
        const opt = document.createElement('option');
        input.appendChild(opt);
        opt.value = i[0];
        opt.textContent = i[1];
    }

    return div;
}

async function checkLogin() {
    const username = sessionStorage.getItem("username");
    if (username) {
        return true;
    }

    var form = document.createElement('form');
    form.setAttribute('action', '');

    const div1 = form_input("Username: ", "username");
    form.appendChild(div1);
    const div2 = form_input("Password: ", "password", "password");
    form.appendChild(div2);

    var submit = document.createElement('button');
    submit.className = "btn btn-default";
    submit.setAttribute('type', 'submit');
    submit.textContent = "Login";
    form.appendChild(submit);

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const elem1 = document.querySelector('#username');
        sessionStorage.setItem("username", elem1.value);
        const elem2 = document.querySelector('#password');
        sessionStorage.setItem("password", elem2.value);
        location.reload();
    });

    const body = document.querySelector("#wheresthebeef");
    body.appendChild(form);
    return false;
}

async function logout() {
    sessionStorage.setItem("username", "");
    sessionStorage.setItem("password", "");
}

function parseQueryString(queryString) {
    const params = {};
    
    if (!queryString || queryString.length === 0) {
        return params;
    }

    // Remove the leading '?' if present
    if (queryString[0] === '?') {
        queryString = queryString.substr(1);
    }

    const keyValuePairs = queryString.split('&');

    for (let i = 0; i < keyValuePairs.length; i++) {
        const pair = keyValuePairs[i].split('=');
        const key = decodeURIComponent(pair[0]);
        const value = pair.length > 1 ? decodeURIComponent(pair[1]) : '';

        params[key] = value;
    }

    return params;
}

// Clear all generated UI elements
function clearUI() {
    const body = document.querySelector("#wheresthebeef");
    body.innerHTML = '';
}

function get_display_name(input_settings, name) {
    if (input_settings && input_settings[name] && input_settings[name]['display']) {
        return input_settings[name]['display'];
    } else {
        return make_pretty(name);
    }
}

function get_input_type(input_settings, name, dtd) {
    if (input_settings && input_settings[name] && input_settings[name]['input']) {
        return input_settings[name]['input'];
    } else {
	if (dtd == "tinyint(1)") {
	    return "checkbox";
	} else {
	    return "text";
	}
    }
}

function set_style_for_element(input_settings, name, form, hidden) {
    if (input_settings && input_settings[name]) {
        if (input_settings[name]['style']) {
            form.style = input_settings[name]['style'];
        }
        if (input_settings[name]['class']) {
            form.setAttribute('class', input_settings[name]['class']);
        }
    } else {
        if (hidden) {
            form.style.display = 'none';
        }
    }
}

function get_options(dtd) {
    const regex = /enum\((.*)\)/;
    const match = regex.exec(dtd);
    if (match) {
        var options = [];
        for (const i of match[1].split(',')) {
            const x = i.replace(/'/g, '');
            options.push([x, x]);
        }
        return options;
    } else {
        return [];
    }
}

// Generate a form for calling a procedure, with the results displayed as tables
async function callProcedureFull({proc_name,
                             format_row = undefined,
                             initial_style = 'block',
                             prev_proc = undefined,
                             action = undefined,
                             links = undefined,
                             input_settings = undefined,
                             output_settings = undefined,
                             show_button = true,
                             show_header = undefined,
                             skip_headers = false,
                             activate = false,
                             after_results = undefined,
                             clear = false,
                             url = 'index.html'})
{
    if (clear) {
        clearUI();
    }

    if (show_header == undefined) {
        if (prev_proc == undefined) {
            show_header = false;
        } else {
            show_header = true;
        }
    }

    const top_div = document.createElement('div');
    top_div.style.display = initial_style;
    top_div.setAttribute('id', proc_name+'_div');

    const body = document.querySelector("#wheresthebeef");
    // If we have a previous form to pull from, we won't generate a new one
    if (show_header) {
        var h = document.createElement('h3');
        body.appendChild(h);

        const span = document.createElement('span');
        h.appendChild(span);
        if (top_div.style.display == 'none') {
            span.className = "glyphicon glyphicon-menu-right";
        } else {
            span.className = "glyphicon glyphicon-menu-down";
        }

        var a = document.createElement('a');
        a.textContent = make_pretty(proc_name);
        h.appendChild(a);

        h.addEventListener('click', (event) => {
            if (top_div.style.display == 'none') {
                top_div.style.display = 'block';
                span.className = "glyphicon glyphicon-menu-down";
            } else {
                top_div.style.display = 'none';
                span.className = "glyphicon glyphicon-menu-right";
            }
        });
    }
    body.appendChild(top_div);

    var proc_info = await get_schema(proc_name);
    var form = document.createElement('form');
    form.setAttribute('action', '');
    form.setAttribute('id', proc_name+'_form');

    if (prev_proc == undefined) {
        for (const e of proc_info) {
            if (e[0] == "IN") {
                if (e[1].startsWith("paginate_")) {
                    continue;
                }

                // If the parameter starts with an underscore, it should be hidden by default
                var hidden = false;
                if (e[1][0] == '_') {
                    e[1] = e[1].slice(1);
                    hidden = true;
                }

                if (e[1].includes('_')) {
                    const parts = e[1].split('_');
                    const generator_proc = parts[0];
                    const display_name = get_display_name(input_settings, parts[1]);
                    const options = await call_procedure(generator_proc);
                    const div = form_select(display_name, `${proc_name}_${parts[1]}`, options);
                    set_style_for_element(input_settings, parts[1], div, hidden);
                    form.appendChild(div);
                } else if (e[2] == 'enum') {
                    const options = get_options(e[3]);
                    const display_name = get_display_name(input_settings, e[1]);
                    const div = form_select(display_name, `${proc_name}_${e[1]}`, options);
                    set_style_for_element(input_settings, e[1], div, hidden);
                    form.appendChild(div);
                } else {
                    const type = get_input_type(input_settings, e[1], e[3]);
                    const div = form_input(get_display_name(input_settings, e[1]), `${proc_name}_${e[1]}`, type, e[2], e[3]);
                    set_style_for_element(input_settings, e[1], div, hidden);
                    form.appendChild(div);
                }
            }
        }
    }

    if (!format_row) {
        format_row = (row, first, column_names) => {
            var tr = document.createElement('tr');

            for (let i=0; i < row.length; i++) {
                const cell = row[i];

                // If the column name starts with an underscore, it should be hidden by default
                var hidden = false;
                if (column_names[i][0] == '_') {
                    hidden = true;
                }

                var td;
                if (first) {
                    if (!skip_headers) {
                        td = document.createElement('th');
                        td.textContent = get_display_name(output_settings, cell);
                        set_style_for_element(output_settings, cell, td, hidden);
                    }
                } else {
                    td = document.createElement('td');
                    td.textContent = cell;
                    set_style_for_element(output_settings, column_names[i], td, hidden);
                }

                if (td) {
                    tr.appendChild(td);
                }
            }

            if (!first && links) {
                for (const k in links) {
                    var proc_name;
                    var autosubmit = false;
                    if (Array.isArray(links[k])) {
                        proc_name = links[k][0];
                        autosubmit = links[k][1];
                    } else {
                        proc_name = links[k];
                    }
                    var q = values_to_query(proc_name, row, column_names);
                    if (autosubmit) {
                        q += "&autosubmit="+proc_name;
                    }
                    const td = document.createElement('td');
                    tr.appendChild(td);
                    const a = document.createElement('a')
                    td.appendChild(a);
                    a.href = url + q;
                    a.textContent = k;
                }
            }

            return tr;
        };
    }

    var submit = document.createElement('button');
    form.appendChild(submit);
    submit.className = "btn btn-default";
    submit.setAttribute('id', proc_name);
    submit.setAttribute('type', 'submit');
    submit.textContent = make_pretty(proc_name);
    if (action) {
        submit.addEventListener('click', action);
    }
    if (!show_button) {
        submit.style.display = 'none';
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        submit_form(proc_name, format_row, prev_proc, after_results);
    });

    top_div.appendChild(form);

    var results = document.createElement('div');
    results.setAttribute('id', `results_${proc_name}`);
    top_div.appendChild(results);

    if (activate) {
        activateProcedure(proc_name);
    }
}

async function callProcedure(proc_name, clear = true) {
    params = {
        proc_name: proc_name,
        clear: clear
    };
    await callProcedureFull(params);
}

// Generate a form for calling a procedure, the results of which are rendered
// into a table for selection.  The selected row is then pushed into the form
// for next_proc
async function callProcedureSelectOutput(proc_name, next_proc, params = {}) {
    params = Object.assign({}, params);
    params.proc_name = proc_name;
    params.next_proc = next_proc;
    params.format_row = (row, first, headers) => {
        var tr = document.createElement('tr');

        var first_cell = true;
        for (let i=0; i < row.length; i++) {
            const cell = row[i];
            const header = headers[i];

            var td;
            if (first) {
                td = document.createElement('th');
                td.textContent = make_pretty(cell);
            } else {
                td = document.createElement('td');
                if (first_cell) {
                    var a = document.createElement('button');
                    a.className = "btn btn-default";
                    a.textContent = cell;
                    td.appendChild(a);

                    a.addEventListener('click', (event) => {
                        for (var h of headers) {
                            if (h[0] == '@') {
                                h = h.slice(1);
                            }
                            const f = document.querySelector(`#${params.next_proc}_${h}`);
                            if (f) {
                                if (f.getAttribute('type') == 'checkbox') {
                                    f.checked = cell != '0';
                                } else {
                                    f.value = cell;
                                }
                            }
                        }
                    });

                } else {
                    td.textContent = cell;
                }
            }
            first_cell = false;
            tr.appendChild(td);
        }

        return tr;
    };
    params.initial_style = 'none';
    await callProcedureFull(params);
}

// Generate a form for calling a procedure, the results of which are rendered
// into a table for selection.  Multiple options can be selected
async function callProcedureSelectMany(proc_name, next_proc, params = {}) {
    params = Object.assign({}, params);
    params.proc_name = proc_name;
    params.format_row = (row, first, headers) => {
        var tr = document.createElement('tr');

        var first_cell = true;
        for (let i=0; i < row.length; i++) {
            const cell = row[i];
            var header = headers[i];
            if (header[0] == '_') {
                header = header.slice(1);
            }

            var td;
            if (first) {
                if (first_cell) {
                    const td = document.createElement('td');
                    tr.appendChild(td);
                }
                td = document.createElement('th');
                td.textContent = make_pretty(cell);
            } else {
                td = document.createElement('td');
                td.setAttribute('data-wtb-column', header);

                if (first_cell) {
                    const input = document.createElement('input');
                    tr.appendChild(input);
                    input.type = 'checkbox';

                    input.addEventListener('input', (event) => {
                        const form = document.querySelector(`#${next_proc}_form`);
                        const results = document.querySelector(`#results_${proc_name}`);
                        const table = results.children[0];

                        for (const e of form.elements) {
                            const name = e.getAttribute('id');
                            const parts = name.split('_');
                            var items = [];

                            // Skip the first header row
                            for (let i=1; i < table.children.length; i++) {
                                const result_row = table.children[i];
                                const checkbox = result_row.children[0];
                                if (!checkbox.checked) {
                                    continue;
                                }

                                for (let j=1; j < result_row.children.length; j++) {
                                    const result_cell = result_row.children[j];
                                    const colname = result_cell.getAttribute('data-wtb-column');

                                    if (colname == parts[1]) {
                                        items.push(result_cell.textContent);
                                    }
                                }
                            }

                            e.value = JSON.stringify(items);
                        }

			if (params.select_many_action) {
                            params.select_many_action(input, event);
			}
                    });
                }
                td.textContent = cell;
            }
            first_cell = false;
            tr.appendChild(td);
        }

        return tr;
    };
    await callProcedureFull(params);
}

// Submit the form associated with proc_name
function activateProcedure(proc_name) {
    var elem = document.querySelector('#' + proc_name);
    if (elem) {
        elem.click();
    }
}

// Parse key/value pairs from the query string, and use those to prefill any
// form elements that match.  This is useful for e.g. modify/update operations.
function prefillForms() {
    var q = parseQueryString(window.location.search);

    for (var k in q) {
        var elem = document.querySelector('#' + k);
        if (elem) {
            if (elem.getAttribute('type') == 'checkbox') {
                elem.checked = q[k] != '0';
            } else {
                elem.value = q[k];
            }
        }
    }

    if (q['autosubmit']) {
        activateProcedure(q['autosubmit']);
    }
}

function values_to_query(proc_name, values, column_names) {
    var q = `?proc=${proc_name}`
    for (let i=0; i<values.length; i++) {
        var col = column_names[i];
        if (col[0] == '_') {
            col = col.slice(1);
        }
        q += '&'
        q += encodeURIComponent(proc_name);
        q += '_'
        q += encodeURIComponent(col);
        q += '='
        q += encodeURIComponent(values[i]);
    }
    return q;
}

// Generate a form for calling a procedure, with the results displayed as
// tables.  Each row will have Edit/Delete links that will use the provided URL
// and edit_proc/delete_proc, respectively.
async function callProcedureEditDelete(proc_name, edit_proc, delete_proc, params = {}) {
    params = Object.assign({}, params);
    params.proc_name = proc_name;
    params.edit_proc = edit_proc;
    params.delete_proc = delete_proc;
    params.links = {
        'Edit': params.edit_proc,
        'Delete': params.delete_proc,
    };
    await callProcedureFull(params);
}

async function callProcedureListEditDelete(object, params = {}) {
    params = Object.assign({}, params);
    if (!params.links) {
        params.links = {};
    }
    if (!params.links['Edit']) {
        params.links['Edit'] = 'modify' + object;
    }
    if (!params.links['Delete']) {
        params.links['Delete'] = 'delete' + object;
    }
    if (params.list_proc) {
        params.proc_name = params.list_proc;
    } else {
        params.proc_name = 'list' + object + 's';
    }
    await callProcedureFull(params);
}

// Generate a form for calling a procedure, the results of which are pushed
// into the forms for outputs.  This just uses the first result, rather than
// presenting the user with a choice linke callProcedureSelectOutput
async function callProcedureOutput(params) {
    params = Object.assign({}, params);
    params.format_row = (row, first, headers) => {
        if (!first) {
            for (let i=0; i < row.length; i++) {
                for (const next of params.outputs) {
                    var field = headers[i];
                    if (field[0] == '@') {
                        field = field.slice(1);
                    }
                    if (field[0] == '_') {
                        field = field.slice(1);
                    }
                    const f = document.querySelector(`#${next}_${field}`);
                    if (f) {
                        if (f.getAttribute('type') == 'checkbox') {
                            f.checked = row[i] != '0';
                        } else {
                            f.value = row[i];
                        }
                    }
                }
            }
        }
    };
    await callProcedureFull(params);
}

// Generate a list of all available routines.  For super-lazy-mode this may be
// all the UI you need.
async function allRoutines() {
    const body = document.querySelector("#wheresthebeef");
    const ul = document.createElement("ul");
    body.appendChild(ul);

    let routines = await get_routines();
    const grants = await get_grants();

    for (const r of routines) {
	if (!grants.includes(r[0].toLowerCase())) {
	    continue;
	}
        const li = document.createElement("li");
        ul.appendChild(li);

        const a = document.createElement('a');
        li.appendChild(a);
        a.textContent = make_pretty(r[0]);
        a.addEventListener('click', (event) => {
            callProcedure(r[0], true);
        });
    }
}

// Hide one div and show another
function showHideDivs(show, hide) {
    var elem = document.querySelector(`#${show}_div`);
    elem.style.display = 'block';
    var elem = document.querySelector(`#${hide}_div`);
    elem.style.display = 'none';
}

// Add a button to the div for a procedure
function addButton(proc_name, label, action = undefined) {
    var button = document.createElement('button');
    const p = document.querySelector(`#${proc_name}_div`);
    p.appendChild(button);

    button.textContent = label;
    button.className = "btn btn-default";
    if (action) {
        button.addEventListener('click', action);
    }

    return button;
}

// Add a button to the div for a procedure that hides on div and shows another.
function addShowHideButton(proc_name, label, show) {
    var button = document.createElement('button');
    const p = document.querySelector(`#${proc_name}_div`);
    p.appendChild(button);

    button.textContent = label;
    button.className = "btn btn-default";
    button.addEventListener('click', (event) => {
        showHideDivs(show, proc_name);
    });

    return button;
}

// Pull a value from src_field in the form for src_proc, and store it to
// dest_field in the form for dest_proc
function copyFromInput(src_proc, src_field, dest_proc, dest_field) {
    if (src_field[0] == '_') {
      src_field = src_field.slice(1);
    }
    if (dest_field[0] == '_') {
      dest_field = dest_field.slice(1);
    }

    const src = document.querySelector(`#${src_proc}_${src_field}`);
    const dest = document.querySelector(`#${dest_proc}_${dest_field}`);
    dest.value = src.value;
}

async function get_grants() {
    var grants = await sql_exec("SHOW GRANTS");
    grants[0].shift();

    var routines = []
    for (const g of grants[0]) {
        if (!g[0].startsWith('GRANT EXECUTE ON PROCEDURE')) {
            continue;
        }

        const words = g[0].split(' ');
        var procedure = words[4];
        procedure = procedure.replace(/`/g, "");
        procedure = procedure.split('.')[1];
        routines.push(procedure);
    }

    return routines;
}
