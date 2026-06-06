const appConfig = require('../../modules/app-config.js')

Page({
  data: {
    appName: appConfig.appName,
    version: appConfig.version,
    supportEmail: appConfig.supportEmail,
    adsEnabled: appConfig.capabilities.adsEnabled,
    paymentEnabled: appConfig.capabilities.paymentEnabled
  }
})
