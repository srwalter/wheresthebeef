What is this?
-------------
Ever wanted to implement a CRUD web app entirely in SQL?  Now you can!

This project started from an idea:  since the DBMS already supports user
management and role-based access control, why not take advantage of that rather
than re-implementing it in the application layer?  And if we can take that out
of the middleware, how far can that go?  (The frontend and the DBMS are the
"buns" in the "where's the beef?" analogy).

This is the result:  a framework where all the "business logic" is implemented
as stored SQL procedures.  The front-end UI can then introspect those
procedures and automatically generate the forms needed for inputs to the
procedure.  All that's left in the middle is a fully generic web service that
takes SQL queries and returns their results as JSON.

Advantages:
 * You can't SQL-inject when the design assumes full client control of the query
 * You get user management and RBAC effectively for free, relying on the DBMS
 * No application layer to implement and manage, only database and (a little) front-end
 * Business logic procedures can be tested from any DBMS client

Ideally, I would like to see even this stub of a middle layer go away.  I think
one could implement a MySQL client in JavaScript that runs in the browser,
talking over a websocket directly to the DBMS.  websocat or similar could be
used to proxy between the websocket and DBMS.

The generated UI was written with Bootstrap in mind, but it would still work
even without that.  See the example/ directory.

You might be wondering: is this a joke or is this serious?  Honestly, I'm not
sure myself...

Getting Started
---------------
1) Create a database for your app:

    MySQL [(none)]> CREATE DATABASE foo;

2) Create a user to be the administrator:

    MySQL [(none)]> CREATE USER 'bob'@'%' IDENTIFIED BY 'password';
    MySQL [(none)]> GRANT ALL PRIVILEGES ON foo.* TO 'bob'@'%';

3) If you want to do user and role administration within your app, you will
have to grant some global priviliges to the administrator user.  Keep this in
mind if you're going to host multiple databases on the same server (i.e., you
probably shouldn't do that):

    MySQL [(none)]> GRANT CREATE USER, GRANT OPTION, ROLE_ADMIN ON *.* TO 'bob'@'%';

If you do the above, then you can use the createUser and grantRole procedures
in procedures.sql for user and role administration.

If you name your procedures and parameters using camelCase or StudlyCaps, then
they will be automatically converted to natural english spacing and
capitalization.

4) Create the schema for your tables.  I keep this in its own file, since it's
only run once after DB creation.

5) Create the stored procedures.  Generally you'll want a create, list, modify,
and delete function for each table.  Any output variables or SELECT results are
rendered as tables in the front-end.  I keep these in procedures.sql since I am
often reloading them into the DBMS during development.

6) Create the frontend.  In the simplest case, you just need a call to
callProcedure() for each of the stored procedures you just created.  Viola, you
have a basic web frontend to your DB.  Actually, in the simplest, simplest
case, just copy example.html and you'll get a list of all the procedures that
are available.

7) Create whatever roles make sense for your application.  For each role, you
just need to grant the list of procedures that role should be allowed to call.

Features
--------
* Generated HTML forms
* Client side validation
* Use the output of one procedure as selection options for another input
* Chaining multiple procedures together (use the output of one as input for the next)
* Pagination
* Uses session storage for authentication values

Procedure Naming Considerations
-------------------------------
* Procedure names and parameter names are "prettified" assuming
  camelCaps/StudlyCaps.  That is, the first letter of each word is capitalized,
  and a space is inserted before each subsequent capital letter.

* If a parameter name includes an underscore, this indicates that it should be
  rendered as a selection rather than a text box.  The string before the
  understore is the procedure to call to get the list of options, and teh
  string after the underscore is the normal display name.

* To support pagination, a procedure should have three extra parameters:
  paginate_count, paginate_offset, and paginate_total.  Count is the number of
  rows to show per page, offset is the offset, and total is an output parameter
  giving the total number of rows.  Form inputs are not generated for these
  parameters.  Additionally, two input elements named "pagination_offset" and
  "pagination_count" are needed to store the offset and count.
  pagination_offset should probably be hidden, however pagination_count could
  be user-visible to allow selectable pages sizes.

JavaScript Documentation
------------------------
    checkLogin()

Generates a login form if there is not already a username and password in session storage.

    logout()

Clears username and password from session storage.

    clearUI()

Remove any previously generated UI elements

    callProcedure(proc_name, clear = true)

The main event.  Generates a form with inputs for each IN parameter, and a
button that actually invokes the procedure.  The results and any output
parameters from the function are rendered as tables.  Calls clearUI() unless
clear is false.

callProcedureFull({proc_name,
                  format_row = undefined,
                  initial_style = 'block',
                  prev_proc = undefined,
                  action = undefined,
                  links = undefined,
                  url = 'index.html',
                  input_settings = undefined,
                  output_settings = undefined,
                  show_button = true,
                  clear = false})

The all-singing, all-dancing version of the above.  format_row is a callable
that is invoke for each row of the returned results, for custom formatting.
initial_style can be used to modify the style of the form, usually to make it
initially hidden.

If prev_proc is provided, then a new form is not generated.  Instead values are
pulled from the form for prev_proc.  This is useful if you have one set of
values but might take mulitple actions from them.

If action is provided, then it is used as the click event handler for the
submit button.

links is a dictionary, where keys are link labels and values are the stored
procedure names.  The value can also specify if the procedure should be
automatically run instead of requiring the user to click the button.

url is used for generating the links specified by the links dictionary.

input_settings and output_settings control the appearance of the input form or
output results, respectively.  For each input field / output column, the
dictionary is checked for a key with the same name.  If present, the "style"
attributed is used for the style of the element, and the "display" attribute is
used for the displayed name, rather than the default make_pretty() function.

show_button controls whether or not the form submit button is shown.  You may
want to hide the button if the form is automatically submitted, for example.

clear controls whether or not clearUI() is called beforehand.

    callProcedureOutput(params)

Generate a form for calling a procedure.  Rather than displaying a table with
the results, they are used to pre-fill the form for "next_proc".  Be sure to
call some form of callProcedure(next_proc) after this function, as well.  The
forms generated by this function start collapsed, the idea being that they are
"helpers" to some other main form.

    callProcedureSelectOutput(params)

The same as callProcedureOutput, except that the results are displayed so that
the user can select a row.  The selected row has its values copied into the
form for next_proc.

    callProcedureEditDelete(params)

The main use case for this function is with procedures that return a list of
rows.  In addition to the normal table rendering, this function will add Edit
and Delete links for each row.  Those links will redirect to "url" with
proc=edit_proc (or delete_proc) in the query string, as well as all the other
values from the selected row.

    callProcedureListEditDelete(object, params)

A helper on top of callProcedureEditDelete.  In the common case where the list
procedure, edit procedure, and delete procedure are uniformly named, (e.g.
"listObjects", "modifyObject", "deleteObject") only the string "Object" needs
to be provided.

    prefillForms()

Parse key/value pairs from the query string, and use those to prefill any
matching form elements.  This should generally be called last after all the
calls to callProcedure*, and is intended to work with callProcedureEditDelete,
above.

    activateProcedure(proc_name)

Submit the form for "proc_name".  This can save a click for procedures that
have no inputs, for example.
