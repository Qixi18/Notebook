import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('noteBuddyDesktop', {
  platform: process.platform,
  version: '0.1.0',
})
