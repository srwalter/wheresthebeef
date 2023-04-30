function postData(url = '', data = {}) {
  // Default options are marked with *
  return fetch(url, {
    method: 'POST', // *HTTP Method type
    headers: {
      'Content-Type': 'application/json' // sending data in JSON format
    },
    body: JSON.stringify(data) // body data type must match "Content-Type" header
  })
  .then(response => response.json()); // parses response to JSON
}

function sql_exec(sql) {
    const username = sessionStorage.getItem("username");
    const password = sessionStorage.getItem("password");
    return postData('http://localhost:8080/database/', { username: username, password: password, sql: sql });
}

async function get_schema(proc_name) {
    let result = await sql_exec(`SELECT PARAMETER_MODE, PARAMETER_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.PARAMETERS WHERE SPECIFIC_NAME = "${proc_name}";`);
    // Get rid of the column names
    result[0].shift();
    return result[0];
}

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

function format_row_basic(row, first) {
    var tr = document.createElement('tr');

    for (const cell of row) {
        var td;
        if (first) {
            td = document.createElement('th');
            td.textContent = make_pretty(cell);
        } else {
            td = document.createElement('td');
            td.textContent = cell;
        }
        tr.appendChild(td);
    }

    return tr;
}

function format_row_link(row, first, next_proc) {
    var tr = document.createElement('tr');

    var first_cell = true;
    for (const cell of row) {
        var td;
        if (first) {
            td = document.createElement('th');
            td.textContent = make_pretty(cell);
        } else {
            td = document.createElement('td');
            if (first_cell) {
                var a = document.createElement('a');
                a.textContent = cell;
                td.appendChild(a);

                a.addEventListener('click', (event) => {
                    const f = document.querySelector(next_proc);
                    f.value = cell;
                });

            } else {
                td.textContent = cell;
            }
        }
        first_cell = false;
        tr.appendChild(td);
    }

    return tr;
}

async function submit_form(proc_name, format_row, prev_proc) {
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
            if (e[1] == "paginate_offset") {
                const offset = document.querySelector("#pagination_offset").value;
                sql += offset;
            } else if (e[1] == "paginate_count") {
                const count = document.querySelector("#pagination_count").value;
                sql += count;
            } else {
                var elem = document.querySelector(`#${prev_name}_${e[1]}`);
                sql += `"${elem.value}"`;
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

    var all_result = await sql_exec(sql);

    var results = document.querySelector(`#results_${proc_name}`);
    results.innerHTML = '';

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
            table.appendChild(tr);
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
                submit_form(proc_name, format_row, prev_proc);
            });
        }
    }
}

function form_input(label, name, type="text") {
    var div = document.createElement('div');
    div.className = "form-group";

    var p = document.createElement('label');
    p.setAttribute('for', name);
    p.textContent = label;
    div.appendChild(p);
    var input = document.createElement('input');
    input.className = "form-control";
    input.setAttribute('id', name);
    input.setAttribute('type', type);
    div.appendChild(input);
    return div;
}

async function login() {
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

    const body = document.querySelector(".body-content");
    body.appendChild(form);
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

// Generate a form for calling a procedure, with the results displayed as tables
async function callProcedure(proc_name, format_row = format_row_basic, initial_style = 'block', prev_proc = undefined) {
    const username = sessionStorage.getItem("username");
    if (!username) {
        login();
        return;
    }

    const top_div = document.createElement('div');
    top_div.style.display = initial_style;

    const body = document.querySelector(".body-content");
    if (prev_proc == undefined) {
        var h = document.createElement('h2');
        var a = document.createElement('a');
        a.textContent = make_pretty(proc_name);
        h.appendChild(a);
        body.appendChild(h);

        h.addEventListener('click', (event) => {
            if (top_div.style.display == 'none') {
                top_div.style.display = 'block';
            } else {
                top_div.style.display = 'none';
            }
        });
    }
    body.appendChild(top_div);

    var proc_info = await get_schema(proc_name);
    var form = document.createElement('form');
    form.setAttribute('action', '');

    if (prev_proc == undefined) {
        for (const e of proc_info) {
            if (e[0] == "IN") {
                if (e[1].startsWith("paginate_")) {
                    continue;
                }
                const div = form_input(make_pretty(e[1]), `${proc_name}_${e[1]}`);
                form.appendChild(div);
            }
        }
    }

    var submit = document.createElement('button');
    submit.className = "btn btn-default";
    submit.setAttribute('type', 'submit');
    submit.textContent = make_pretty(proc_name);
    form.appendChild(submit);

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        submit_form(proc_name, format_row, prev_proc);
    });

    top_div.appendChild(form);

    var results = document.createElement('div');
    results.setAttribute('id', `results_${proc_name}`);
    top_div.appendChild(results);
}

// Generate a form for calling a procedure, the results of which are pushed
// into the form for "next_proc"
async function callProcedureChained(proc_name, next_proc) {
    await callProcedure(proc_name, (row, first) => {
        return format_row_link(row, first, next_proc);
    }, 'none');
}

// Parse key/value pairs from the query string, and use those to prefill any
// form elements that match.  This is useful for e.g. modify/update operations.
function prefillForms() {
    var q = parseQueryString(window.location.search);

    for (const k in q) {
        var elem = document.querySelector('#' + k);
        if (elem) {
            elem.value = q[k];
        }
    }
}

function values_to_query(proc_name, values, column_names) {
    var q = `?proc=${proc_name}`
    for (let i=0; i<values.length; i++) {
        q += '&'
        q += encodeURIComponent(proc_name);
        q += '_'
        q += encodeURIComponent(column_names[i]);
        q += '='
        q += encodeURIComponent(values[i]);
    }
    return q;
}

// Generate a form for calling a procedure, with the results displayed as
// tables.  Each row will have Edit/Delete links that will use the provided URL
// and edit_proc/delete_proc, respectively.
async function callProcedureEditDelete(proc_name, url, edit_proc, delete_proc) {
    await callProcedure(proc_name, (row, first, column_names) => {
        if (first) {
            return format_row_basic(row, first);
        }

        var tr = document.createElement('tr');

        for (const cell of row) {
            var td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
        }

        var q = values_to_query(edit_proc, row, column_names);
        var td = document.createElement('td');
        tr.appendChild(td);
        var edit = document.createElement('a')
        edit.href = url + q;
        td.appendChild(edit);
        edit.textContent = 'Edit';

        var q = values_to_query(delete_proc, row, column_names);
        var td = document.createElement('td');
        tr.appendChild(td);
        var edit = document.createElement('a')
        edit.href = url + q;
        td.appendChild(edit);
        edit.textContent = 'Delete';

        return tr;
    });
}

// Generate a button for calling a procedure, with the results displayed as
// tables.  The inputs are pulled from the form for "prev_proc" rather than
// making a new form.
async function callProcedureShared(proc_name, prev_proc) {
    return callProcedure(proc_name, undefined, undefined, prev_proc);
}

