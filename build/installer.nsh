!include "FileFunc.nsh"
!include "LogicLib.nsh"

!macro customInit
  ; Safe initialization for fresh installs and in-app updates
  ; Terminate any running ClueAI processes so files are never locked during install or update
  nsExec::Exec 'taskkill /F /T /IM ClueAI.exe'
  nsExec::Exec 'taskkill /F /T /IM clueai.exe'
  Sleep 300
  ; Do NOT delete $LOCALAPPDATA\clueai-updater because in-app updates run directly from that folder
  ; Do NOT delete user data/settings during installation
!macroend

!macro customUnInstall
  ; 1. Terminate any running ClueAI processes
  nsExec::Exec 'taskkill /F /T /IM ClueAI.exe'
  nsExec::Exec 'taskkill /F /T /IM clueai.exe'

  ; 2. Wipe all UserData, settings, resumes, and API keys completely
  RMDir /r "$APPDATA\ClueAI"
  RMDir /r "$APPDATA\clueai"

  ; 3. Wipe all local app data, caches, update staging files, and installed files
  RMDir /r "$LOCALAPPDATA\ClueAI"
  RMDir /r "$LOCALAPPDATA\clueai"
  RMDir /r "$LOCALAPPDATA\clueai-updater"
  RMDir /r "$LOCALAPPDATA\Programs\clueai"
  RMDir /r "$LOCALAPPDATA\Programs\ClueAI"

  ; 4. Wipe temporary files
  RMDir /r "$TEMP\clueai*"
  RMDir /r "$TEMP\electron*"

  ; 5. Remove all registry entries
  DeleteRegKey HKCU "Software\ClueAI"
  DeleteRegKey HKCU "Software\clueai"
  DeleteRegKey HKCU "Software\com.clueai.app"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClueAI"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.clueai.app"
!macroend

