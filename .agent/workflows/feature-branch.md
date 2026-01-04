---
description: How to safely develop features using git branches
---

1. Create a new branch for the task
   - Name format: `feature/short-description` or `fix/issue-description`
   - Command: `git checkout -b feature/new-feature-name`

2. Work on the feature
   - Perform code changes
   - Verify changes

3. Commit changes
   - `git add .`
   - `git commit -m "feat: description of changes"`

4. Merge back to main
   - Switch to main: `git checkout main`
   - Pull latest: `git pull origin main` (optional if working alone locallly but good practice)
   - Merge branch: `git merge feature/new-feature-name`
   - Push to remote: `git push origin main`

5. Cleanup
   - Delete branch: `git branch -d feature/new-feature-name`
