import jenkins.model.*
import hudson.model.*

def instance = Jenkins.getInstance()
def pm = instance.getPluginManager()
def uc = instance.getUpdateCenter()

uc.updateAllSites()

def pluginsToInstall = [
    "cloudbees-folder",         // user folder isolation
    "matrix-auth",              // RBAC
    "docker-workflow",          // Docker Pipeline Plugin
    "git",
    "workflow-aggregator",      // Pipeline
    "pipeline-stage-view",
    "blueocean-rest",
    "credentials",
    "plain-credentials",
]

pluginsToInstall.each { pluginName ->
    if (!pm.getPlugin(pluginName)) {
        def plugin = uc.getPlugin(pluginName)
        if (plugin) {
            plugin.deploy(true)
            println "Installing plugin: ${pluginName}"
        }
    }
}

// Create top-level "users" folder
def usersFolder = instance.getItem("users")
if (!usersFolder) {
    def folder = new com.cloudbees.hudson.plugins.folder.Folder(instance, "users")
    instance.add(folder, "users")
    instance.save()
    println "Created 'users' folder"
}

println "Jenkins plugins configured"
