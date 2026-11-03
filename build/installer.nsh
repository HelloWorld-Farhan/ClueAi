!include "FileFunc.nsh"
!include "LogicLib.nsh"

!macro customInit
  ; Forcefully kill any running instances or background processes of ClueAI
  nsExec::Exec 'cmd /c "taskkill /F /T /IM ClueAI.exe /IM clueai.exe >nul 2>&1"'
  Sleep 500
  
  ; Check command line parameters
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "--updated" $R1
  ${IfNot} ${Errors}
    ; Invoked by in-app autoUpdater: Preserve user settings, resumes, and API keys
    Goto endCustomInit
  ${EndIf}

  ; Check if in-app update token file exists in AppData
  IfFileExists "$APPDATA\ClueAI\.in_app_update" 0 checkClueaiLower
    Delete "$APPDATA\ClueAI\.in_app_update"
    Goto endCustomInit

  checkClueaiLower:
  IfFileExists "$APPDATA\clueai\.in_app_update" 0 isFreshInstall
    Delete "$APPDATA\clueai\.in_app_update"
    Goto endCustomInit

  isFreshInstall:
    ; Fresh installer download run:
    ; 1. Clean previous user data and cache to ensure clean slate
    RMDir /r "$APPDATA\ClueAI"
    RMDir /r "$APPDATA\clueai"
    RMDir /r "$LOCALAPPDATA\ClueAI"
    RMDir /r "$LOCALAPPDATA\clueai"
    RMDir /r "$LOCALAPPDATA\clueai-updater"

  endCustomInit:
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

