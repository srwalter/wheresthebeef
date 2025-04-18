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

    MySQL [(none)]> CREATE USER 'bob'@'localhost' IDENTIFIED BY 'password';
    MySQL [(none)]> GRANT ALL PRIVILEGES ON foo.* TO 'bob'@'localhost';

3) If you want to do user and role administration within your app, you will
have to grant some global priviliges to the administrator user.  Keep this in
mind if you're going to host multiple databases on the same server (i.e., you
probably shouldn't do that):

    MySQL [(none)]> GRANT CREATE USER, GRANT OPTION, ROLE_ADMIN ON *.* TO 'bob'@'localhost';

If you do the above, then you can use the createUser and grantRole procedures
in procedures.sql for user and role administration.

NOTE: you should be sure to create all procedures using the account just
created, particularly not root.  This is because procedures get the permissions
of the user that defines them by default.  Therefore, creating the procedures
as root means that they will run with excess privilege.

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
In general you will want an "admin" role that can execute all of your
procedures.  Be sure to assign this role to even the admin user, created above.
This is more or less required due to a bug in MySQL:

    https://bugs.mysql.com/bug.php?id=110997

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
  understore is the procedure to call to get the list of options, and the
  string after the underscore is the normal display name.

* To support pagination, a procedure should have three extra parameters:
  paginate_count, paginate_offset, and paginate_total.  Count is the number of
  rows to show per page, offset is the offset, and total is an output parameter
  giving the total number of rows.  Form inputs are not generated for these
  parameters.  Additionally, two input elements named "pagination_offset" and
  "pagination_count" are needed to store the offset and count.
  pagination_offset should probably be hidden, however pagination_count could
  be user-visible to allow selectable pages sizes.

High-Level Model
----------------
The general model for development is you have some number of operations (stored
procedures) that you apply to your data structures (tables).  If your problem
is easily structured this way, then this project should be a good fit.  You'll
then have a simple UI for each operation, using the WTB object, documented
next.

JavaScript Function Documentation
---------------------------------
    new WTB(proc_name)

Create a new WTB object for a stored procedure named proc_name.  Further
customizations can be made by using the other member functions.  Once
customizations are complete, you must finalize the object using either
generate() or activate()

    generate()

Finish this WTB object and generate its form.  The form will have an input
element for each IN parameter in the corresponding stored procedure, and a
button to invoke the procedure.  The results and any output parameters from the
function are rendered as tables.

    activate()

Finish this WTB object, generate its form, and activate it.

### Object Customization
    hideButton()

Don't show the form's submit button.  Useful if it will be invoked by code
rather than by the user.

    showHeader()

Show a header with the procedure's name at the beginning of the form.  This
also allows collapsing/hiding the form by clicking the header.

    hideHeader()

Don't show the header.

    addLink(name, proc_name)

For each row in the results, add a link.  "name" will be the text of the link,
and proc_name is the stored procedure to be shown when the link is clicked.

    addOutput(wtb)

When this object's stored procedure is invoked, its results will be "pushed"
into the form for wtb, rather than being rendered as normal.  For example, if
this object's stored procedure creates a new row and returns the primary key of
that row, then wtb could then also operate on that row.  This form will start
collapsed, with the idea being that they are "helpers" to some other main form.

    select(list_proc)

Create a new WTB object that will invoke list_proc to get a list of possible
inputs for the function.  The user can then select the desired input.  This can
be used rather than addOutput() when the user has a choice to make.  This object
may be customized as any other WTB, and must also be finalized with either
generate() or activate()

    selectMany(list_proc)

Same as select() but allows multiple inputs to be selected.  The inputs are
passed to the function as a JSON list object.  This object may be customized as
any other WTB, and must also be finalized with either generate() or activate()

    toggleAll()

Add a button to toggle all input options.  Intended for use with selectMany,
above.

    procName(name)

Set the name of the stored procedure to name.  Primarily useful with listEditDelete.

    chain(prev_proc)

Rather than generate a new form, use the form that was generated by prev_proc.
This is useful if you have one set of input values but might take multiple
actions with them.  You can think of this as a "pull" operation, rather than
addOutput's "push" operation.

    action(f)

Specify a call back for the submit button's click event handler.

    selectManyAction(f)

Used with selectMany().  f will be called any time an input row is selected or
deselected.

    afterResults(f)

f will be called after the result of the stored procedure has been rendered.

    inputSettings(o)

For each input field of the form, o is checked for a key with the same name.
If present, the "style" attributed is used for the style of the element, and
the "display" attribute is used for the displayed name, rather than the default
make_pretty() function.

    outputSettings(o)

Same as inputSettings, but controls rendering of the results.

### Alternate Constructors
    static listEditDelete(object)

A helper for the common case of wanting to list a table, with links for Edit
and Delete.  This function assumes a naming convention of 'list'+object+'s',
'modify'+object, and 'delete'+object for the corresponding stored procedures.

### Static Helper Functions

    static async checkLogin()

Generates a login form if there is not already a username and password in session storage.

    static async logout()

Clears username and password from session storage.

    static async activateProcedure(proc_name)

Invoke the given procedure using the inputs from its form.  The same as if the
user clicked the form's button.  This can save the user a click for stored
procedures with no inputs.

    static clear()

Remove any previously generated UI elements

    static prefillForms()

Parse key/value pairs from the query string, and use those to prefill any
matching form elements.  This should generally be called last after all WTB
objects have been generated.

