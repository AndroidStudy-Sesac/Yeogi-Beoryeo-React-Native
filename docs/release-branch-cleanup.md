# 릴리즈 브랜치 자동 정리

`release/*` 브랜치는 먼저 `main`에 병합한 뒤, 같은 브랜치를 `develop`에 병합합니다. `develop` PR이 병합되면 현재 릴리즈 커밋이 두 대상 브랜치에 모두 포함됐는지 확인하고 원격 릴리즈 브랜치를 삭제합니다.

두 PR에는 **Create a merge commit**을 사용합니다. squash 또는 rebase로 원래 커밋 이력이 사라지면 자동 정리를 건너뛰고 브랜치를 보존합니다.

## 삭제 조건

- 같은 저장소의 `release/*` 브랜치를 `develop`에 병합한 PR이어야 합니다.
- 같은 릴리즈 브랜치를 `main`에 먼저 병합한 PR이 있어야 합니다.
- 현재 릴리즈 커밋이 병합한 `develop` PR의 마지막 커밋과 같고, `main`과 `develop` 양쪽 이력에 포함돼야 합니다.
- 해당 브랜치를 출발지 또는 대상으로 사용하는 열린 PR이 없어야 합니다.
- 검사 후 새 커밋이 추가되면 Git의 커밋 일치 검사로 삭제를 거부합니다.

`main`, `develop`과 일반 기능 브랜치는 이 워크플로의 삭제 대상에 포함되지 않습니다. 이미 삭제된 브랜치는 다시 삭제하지 않습니다. API나 Git 작업이 실패하면 워크플로도 실패하며 보호 규칙을 해제하지 않습니다.

## 최초 활성화

워크플로는 기본 브랜치인 `main`의 코드로 실행합니다. 처음 `develop`에 반영한 뒤 첫 릴리즈를 `main`에 병합하면, 이어지는 `release/*` → `develop` 병합부터 실행할 수 있습니다.

관리자는 활성화 전에 다음 항목을 설정합니다.

deploy key 사용은 조직 정책에서 허용돼 있어야 합니다. 이 정책은 조직 전체에 적용되므로 저장소 설정만으로 해제할 수 없습니다. 조직에서 사용을 막고 있으면 키 등록과 자동 삭제 활성화를 보류합니다. 자세한 범위는 [GitHub의 deploy key 정책](https://docs.github.com/en/enterprise-cloud@latest/organizations/managing-organization-settings/restricting-deploy-keys-in-your-organization)에서 확인합니다.

1. 이 저장소에만 사용할 SSH deploy key를 만들고 쓰기 권한으로 등록합니다. 개인 계정의 SSH 키나 토큰은 재사용하지 않습니다.
2. `release-cleanup` GitHub Environment를 만들고 실행 허용 브랜치를 `main`으로 한정합니다. 이 환경에 개인 키를 `RELEASE_CLEANUP_SSH_KEY` Secret으로 등록합니다.
3. 릴리즈 삭제 보호 ruleset에만 `DeployKey`의 `always` 우회를 추가합니다. `main`, `develop` 보호 ruleset에는 우회를 추가하지 않습니다.
4. GitHub의 `DeployKey` 우회는 특정 키 하나가 아니라 deploy key 유형 전체에 적용되므로, 이후 쓰기 가능한 deploy key를 추가할 때 같은 삭제 권한을 갖는지 확인합니다.

일반 GitHub Actions 토큰은 조회에만 사용합니다. 정리 워크플로는 PR 브랜치의 코드, 의존성 설치나 빌드를 실행하지 않습니다. 관리자는 환경 Secret과 기본 브랜치의 워크플로 수정 권한을 함께 점검합니다.

## 실행 확인과 재시도

GitHub Actions의 `Release branch cleanup`에서 대상 PR 실행과 마지막 로그를 확인합니다. 유지된 브랜치는 한쪽에만 반영됐거나, 추가 커밋 또는 열린 PR이 남았는지 로그에 표시합니다. 자격 증명이나 일시적인 API 문제를 해결한 뒤 같은 실행을 다시 실행할 수 있습니다. 브랜치에 새 커밋이 추가됐거나 다른 커밋으로 다시 만들어졌다면 이전 실행은 삭제하지 않습니다.

로컬에서는 다음 명령으로 안전 조건과 실제 Git 삭제 경합을 검증합니다.

```bash
node --test .github/scripts/cleanup-release.node-test.cjs
```

관련 작업: [KAN-20](https://yeogi-beoryeo-rn.atlassian.net/browse/KAN-20), [GitHub #88](https://github.com/AndroidStudy-Sesac/Yeogi-Beoryeo-React-Native/issues/88)
