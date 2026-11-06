!include "FileFunc.nsh"
!include "LogicLib.nsh"

!macro customInit
  ; Automatically terminate any lingering ClueAI instances to prevent file locks or "ClueAI cannot be closed" prompts
  nsExec::ExecToLog 'cmd.exe /C taskkill /F /IM "ClueAI.exe" /T'
  nsExec::ExecToLog 'cmd.exe /C taskkill /F /IM "clueai.exe" /T'
  Sleep 1000
!macroend

!macro customUnInstall
  ; Only perform complete wipe during explicit user uninstallation, NEVER during in-app or installer updates!
  ${ifNot} ${isUpdated}
    ; 1. Wipe UserData, settings, resumes, and API keys completely
    RMDir /r "$APPDATA\ClueAI"
    RMDir /r "$APPDATA\clueai"

    ; 2. Wipe local app data, caches, update staging files, and installed files
    RMDir /r "$LOCALAPPDATA\ClueAI"
    RMDir /r "$LOCALAPPDATA\clueai"
    RMDir /r "$LOCALAPPDATA\clueai-updater"
    RMDir /r "$LOCALAPPDATA\Programs\clueai"
    RMDir /r "$LOCALAPPDATA\Programs\ClueAI"

    ; 3. Wipe temporary files
    RMDir /r "$TEMP\clueai*"
    RMDir /r "$TEMP\electron*"

    ; 4. Remove registry entries
    DeleteRegKey HKCU "Software\ClueAI"
    DeleteRegKey HKCU "Software\clueai"
    DeleteRegKey HKCU "Software\com.clueai.app"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ClueAI"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.clueai.app"
  ${endif}
!macroend

