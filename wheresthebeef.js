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

async function submit_form(proc_name, format_row) {
    var proc_info = await get_schema(proc_name);

    var sql = `CALL ${proc_name}(`;

    var first = true;
    var have_output = false;

    for (const e of proc_info) {
        if (!first) {
            sql += ',';
        }
        first = false;

        if (e[0] == "IN") {
            var elem = document.querySelector(`#${proc_name}_${e[1]}`);
            sql += `"${elem.value}"`;
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

    for (const result of all_result) {
        var table = document.createElement('table');
        table.className = "table";

        var first = true;
        for (const row of result) {
            const tr = format_row(row, first);
            table.appendChild(tr);
            first = false;
        }
        results.appendChild(table);
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

    document.body.appendChild(form);
}

async function logout() {
    sessionStorage.setItem("username", "");
    sessionStorage.setItem("password", "");
}

async function callProcedureChained(proc_name, next_proc) {
    await callProcedure(proc_name, (row, first) => {
        return format_row_link(row, first, next_proc);
    }, 'none');
}

async function callProcedure(proc_name, format_row = format_row_basic, initial_style = 'block') {
    const username = sessionStorage.getItem("username");
    if (!username) {
        login();
        return;
    }

    const top_div = document.createElement('div');
    top_div.style.display = initial_style;
    var h = document.createElement('h2');
    var a = document.createElement('a');
    a.textContent = make_pretty(proc_name);
    h.appendChild(a);
    document.body.appendChild(h);
    h.addEventListener('click', (event) => {
        if (top_div.style.display == 'none') {
            top_div.style.display = 'block';
        } else {
            top_div.style.display = 'none';
        }
    });
    document.body.appendChild(top_div);

    var proc_info = await get_schema(proc_name);
    var form = document.createElement('form');
    form.setAttribute('action', '');

    for (const e of proc_info) {
        if (e[0] == "IN") {
            const div = form_input(make_pretty(e[1]), `${proc_name}_${e[1]}`);
            form.appendChild(div);
        }
    }

    var submit = document.createElement('button');
    submit.className = "btn btn-default";
    submit.setAttribute('type', 'submit');
    submit.textContent = make_pretty(proc_name);
    form.appendChild(submit);

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        submit_form(proc_name, format_row);
    });

    top_div.appendChild(form);

    var results = document.createElement('div');
    results.setAttribute('id', `results_${proc_name}`);
    top_div.appendChild(results);
}
