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
    return result[0];
}

async function submit_form(proc_name) {
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
            var elem = document.querySelector('#'+e[1]);
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

    var results = document.querySelector('#results');
    results.innerHTML = '';

    for (const result of all_result) {
        var table = document.createElement('table');

        for (const row of result) {
            var tr = document.createElement('tr');
            table.appendChild(tr);

            for (const cell of row) {
                var td = document.createElement('td');
                td.textContent = cell;
                tr.appendChild(td);
            }
        }
        results.appendChild(table);
    }
}

function form_input(label, name, type="text") {
    var div = document.createElement('div');
    var p = document.createElement('p');
    p.textContent = label;
    div.appendChild(p);
    var input = document.createElement('input');
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

    var submit = document.createElement('input');
    submit.setAttribute('type', 'submit');
    submit.setAttribute('value', "Login");
    form.appendChild(submit);

    form.addEventListener('submit', (event) => {
        alert("submit");
        event.preventDefault();
        const elem1 = document.querySelector('#username');
        sessionStorage.setItem("username", elem1.value);
        const elem2 = document.querySelector('#password');
        sessionStorage.setItem("password", elem2.value);
        location.reload();
    });

    document.body.appendChild(form);
}

async function universal_form(proc_name) {
    const username = sessionStorage.getItem("username");
    if (!username) {
        login();
        return;
    }

    var proc_info = await get_schema(proc_name);
    var form = document.createElement('form');
    form.setAttribute('id', 'mainform');
    form.setAttribute('action', '');

    for (const e of proc_info) {
        if (e[0] == "IN") {
            const div = form_input(e[1], e[1]);
            form.appendChild(div);
        }
    }

    var submit = document.createElement('input');
    submit.setAttribute('type', 'submit');
    submit.setAttribute('value', proc_name);
    form.appendChild(submit);

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        submit_form(proc_name);
    });

    document.body.appendChild(form);

    var results = document.createElement('div');
    results.setAttribute('id', 'results');
    document.body.appendChild(results);
}