#!/bin/bash

################################################################################
# MALICIOUS COMMIT REMOVAL SCRIPT
# 
# This script removes malicious commits from Git history using git filter-repo
# It will completely purge the following commits:
# 1. 2e6303d08b2600c56a22cf0923e7d1889a4c3755 - Removed malicious loader from vite.config.js
# 2. 3d4adec16720c8b82815216db79737f39e3bd770 - Removed suspicious files
#
# WARNING: This rewrites Git history. All collaborators must rebase after this.
################################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MALICIOUS_COMMITS=(
  "2e6303d08b2600c56a22cf0923e7d1889a4c3755"
  "3d4adec16720c8b82815216db79737f39e3bd770"
)

REPO_ROOT=$(git rev-parse --show-toplevel)
BACKUP_BRANCH="backup-before-malware-removal-$(date +%s)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  MALICIOUS COMMIT REMOVAL SCRIPT${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Verify we're in a Git repository
echo -e "${YELLOW}[1/8] Verifying Git repository...${NC}"
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo -e "${RED}ERROR: Not in a Git repository${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Valid Git repository${NC}"
echo ""

# Step 2: Check current branch
echo -e "${YELLOW}[2/8] Checking current branch...${NC}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "${BLUE}Current branch: ${CURRENT_BRANCH}${NC}"
echo ""

# Step 3: Create backup branch
echo -e "${YELLOW}[3/8] Creating backup branch...${NC}"
echo -e "${BLUE}Backup branch name: ${BACKUP_BRANCH}${NC}"
git branch "$BACKUP_BRANCH"
echo -e "${GREEN}✓ Backup branch created: ${BACKUP_BRANCH}${NC}"
echo ""

# Step 4: Verify malicious commits exist
echo -e "${YELLOW}[4/8] Verifying malicious commits exist in history...${NC}"
for commit in "${MALICIOUS_COMMITS[@]}"; do
  if git cat-file -t "$commit" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Found commit: ${commit}${NC}"
  else
    echo -e "${RED}✗ Commit not found: ${commit}${NC}"
  fi
done
echo ""

# Step 5: Check if git filter-repo is installed
echo -e "${YELLOW}[5/8] Checking for git-filter-repo...${NC}"
if ! command -v git-filter-repo &> /dev/null; then
  echo -e "${YELLOW}git-filter-repo not found. Attempting to install...${NC}"
  
  if command -v pip3 &> /dev/null; then
    pip3 install git-filter-repo
    echo -e "${GREEN}✓ git-filter-repo installed via pip3${NC}"
  elif command -v pip &> /dev/null; then
    pip install git-filter-repo
    echo -e "${GREEN}✓ git-filter-repo installed via pip${NC}"
  else
    echo -e "${RED}ERROR: pip/pip3 not found. Please install git-filter-repo manually:${NC}"
    echo -e "${RED}  pip install git-filter-repo${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}✓ git-filter-repo is installed${NC}"
fi
echo ""

# Step 6: Fetch latest from remote
echo -e "${YELLOW}[6/8] Fetching latest from remote...${NC}"
git fetch origin
echo -e "${GREEN}✓ Fetched latest changes${NC}"
echo ""

# Step 7: Run git filter-repo to remove commits
echo -e "${YELLOW}[7/8] Removing malicious commits from history...${NC}"
echo -e "${RED}This will rewrite Git history. Please wait...${NC}"
echo ""

# Create a Python script that git-filter-repo will execute
FILTER_SCRIPT=$(mktemp)
cat > "$FILTER_SCRIPT" << 'PYTHON_SCRIPT'
#!/usr/bin/env python3
import sys

# Malicious commits to remove
MALICIOUS_COMMITS = {
    b"2e6303d08b2600c56a22cf0923e7d1889a4c3755",
    b"3d4adec16720c8b82815216db79737f39e3bd770",
}

def commit_callback(commit):
    """
    Filter callback to remove malicious commits
    Returns False to skip the commit, True to keep it
    """
    commit_hash = commit.original_id
    
    if commit_hash in MALICIOUS_COMMITS:
        print(f"[REMOVING] Malicious commit: {commit_hash.decode()}", file=sys.stderr)
        return False  # Skip this commit
    
    return True  # Keep this commit

if __name__ == "__main__":
    # This script is called by git-filter-repo
    pass
PYTHON_SCRIPT

# Run git filter-repo with the commit filter
git filter-repo \
  --commit-callback "python3 $FILTER_SCRIPT" \
  --force \
  --all

# Clean up temporary script
rm -f "$FILTER_SCRIPT"

echo -e "${GREEN}✓ Malicious commits removed from history${NC}"
echo ""

# Step 8: Show results and instructions
echo -e "${YELLOW}[8/8] Operation Complete!${NC}"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  CLEANUP SUCCESSFUL${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}What was done:${NC}"
echo -e "  ✓ Backup branch created: ${BACKUP_BRANCH}"
echo -e "  ✓ Malicious commits removed from history"
echo -e "  ✓ All branches and tags updated"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Verify the changes look correct:"
echo -e "     ${BLUE}git log --oneline -20${NC}"
echo ""
echo -e "  2. Force push to remote (CAUTION - rewrites history):"
echo -e "     ${BLUE}git push origin --force-with-lease --all${NC}"
echo -e "     ${BLUE}git push origin --force-with-lease --tags${NC}"
echo ""
echo -e "  3. Notify all team members to run:"
echo -e "     ${BLUE}git fetch origin${NC}"
echo -e "     ${BLUE}git rebase origin/main${NC}"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo -e "  • Your backup branch is: ${BACKUP_BRANCH}"
echo -e "  • Keep it safe in case you need to recover"
echo -e "  • After force push, team members should:"
echo -e "    - Delete their local branches: git branch -D main"
echo -e "    - Recreate from remote: git checkout main"
echo ""
echo -e "${RED}WARNING: Do NOT continue if you haven't verified the backup!${NC}"
echo ""

# Ask for confirmation before force push
read -p "Do you want to force-push these changes to remote now? (yes/no): " -r
echo ""
if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo -e "${YELLOW}Force-pushing to remote...${NC}"
  git push origin --force-with-lease --all
  git push origin --force-with-lease --tags
  echo -e "${GREEN}✓ Force-push completed!${NC}"
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  MALICIOUS COMMITS COMPLETELY REMOVED${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo -e "${BLUE}Alert your team with this message:${NC}"
  echo -e ""
  echo -e "${RED}⚠️  CRITICAL: Repository history has been rewritten to remove malicious code.${NC}"
  echo -e "All team members must update their local repositories:"
  echo ""
  echo -e "  git fetch origin"
  echo -e "  git branch -D main                # Delete your local main"
  echo -e "  git checkout main                # Recreate from remote"
  echo -e "  git pull origin main             # Sync latest changes"
  echo ""
  echo -e "Do NOT merge or rebase against old commits!"
  echo ""
else
  echo -e "${YELLOW}Force-push cancelled.${NC}"
  echo ""
  echo -e "${BLUE}You can force-push manually later with:${NC}"
  echo -e "  ${BLUE}git push origin --force-with-lease --all${NC}"
  echo -e "  ${BLUE}git push origin --force-with-lease --tags${NC}"
  echo ""
  echo -e "${BLUE}Your backup branch is safe at: ${BACKUP_BRANCH}${NC}"
fi
