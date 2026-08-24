# Rclone sync for APP SYSTEM FILES (personal Gmail)

Personal Google accounts cannot upload via a service account (0 Drive quota).
Use this PC workflow instead:

## One-time setup on the PC

1. Install [rclone](https://rclone.org/downloads/)
2. Configure a Google Drive remote (signed in as the account that owns `APP SYSTEM FILES`):

```bat
rclone config
```

- Name: `gdrive`
- Storage: Google Drive
- Scope: full Drive access
- Complete browser login

3. Confirm the remote can see the folder:

```bat
rclone lsd gdrive:"APP SYSTEM FILES"
```

## Each consolidation cycle

1. In BAC Admin, click **Download for rclone**
2. Extract `APP-SYSTEM-FILES-FY####-rclone.zip`
3. Sync the year folder (the one that contains `PPMP\`):

```bat
scripts\rclone\sync-app-system-files.bat "C:\path\to\extracted\2027"
```

or PowerShell:

```powershell
.\scripts\rclone\sync-app-system-files.ps1 -Source "C:\path\to\extracted\2027"
```

## Target layout on Drive

```
APP SYSTEM FILES/
  2027/
    PPMP/
      OCHO/
        OCHO (IND PPMP).xls
      IT/
        IT (IND PPMP).xlsx
    CSE-APP/          (if consolidated)
    nonCSE-APP/       (if consolidated)
```

If your rclone remote is not named `gdrive`, edit the script or pass `-Remote yourname` in PowerShell.
