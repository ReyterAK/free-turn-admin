//
// uiBridge.js
// Release 1.0.0
// UI compatibility layer
//

window.showTab = function(name) {

    if (window.App && typeof App.showTab === "function")
        return App.showTab(name);

    console.warn("App.showTab() not available");

};


// ----------------------------------------------------
// Clients
// ----------------------------------------------------

window.loadClients =
    () => ClientsModule.refresh();

window.addClient =
    () => ClientsModule.add();

window.deleteClient =
    id => ClientsModule.delete(id);

window.updateClient =
    id => ClientsModule.edit(id);


// ----------------------------------------------------
// Server
// ----------------------------------------------------

window.restartServer =
    () => ServerModule.restart();


// ----------------------------------------------------
// Status
// ----------------------------------------------------

window.refreshSystem =
    () => StatusModule.refresh();


// ----------------------------------------------------
// Connection
// ----------------------------------------------------

window.saveConnection =
    () => ConnectionModule.save();


// ----------------------------------------------------
// Password
// ----------------------------------------------------

window.openPasswordModal =
    () => PasswordModule.open();

window.closePasswordModal =
    () => PasswordModule.close();

window.changePassword =
    () => PasswordModule.submit();


// ----------------------------------------------------
// Authentication
// ----------------------------------------------------

window.logout =
    () => AuthModule.logout();