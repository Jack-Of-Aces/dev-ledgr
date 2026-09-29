// Package model defines the API wire types. Field names and shapes mirror the
// frontend contracts in frontend/src/types so responses can be consumed as-is.
package model

import (
	"encoding/json"
	"slices"
	"strings"
	"time"
)

type Role string

const (
	RoleUser     Role = "user"
	RoleReviewer Role = "reviewer"
	RoleAdmin    Role = "admin"
)

func (r Role) Valid() bool { return r == RoleUser || r == RoleReviewer || r == RoleAdmin }

type Permission string

const (
	PermViewIdeas         Permission = "view_ideas"
	PermSubmitSolution    Permission = "submit_solution"
	PermViewJobs          Permission = "view_jobs"
	PermApplyJob          Permission = "apply_job"
	PermViewCoaching      Permission = "view_coaching"
	PermRunAICoach        Permission = "run_ai_coach"
	PermEditOwnProfile    Permission = "edit_own_profile"
	PermReviewSubmissions Permission = "review_submissions"
	PermStampSolution     Permission = "stamp_solution"
	PermSeedIdeas         Permission = "seed_ideas"
	PermManagePlatform    Permission = "manage_platform"
	// PermAssignRoles grants or revokes reviewer clearance. It is separate from
	// PermManagePlatform on purpose: the latter also guards job ingestion and
	// problem seeding, neither of which a reviewer should inherit by being able
	// to staff the review queue.
	PermAssignRoles Permission = "assign_roles"
)

var userPerms = []Permission{
	PermViewIdeas, PermSubmitSolution, PermViewJobs, PermApplyJob,
	PermViewCoaching, PermRunAICoach, PermEditOwnProfile,
}

var reviewerPerms = append(slices.Clone(userPerms), PermReviewSubmissions, PermStampSolution, PermAssignRoles)

// RolePermissions mirrors ROLE_PERMISSIONS in frontend/src/types/auth.ts.
var RolePermissions = map[Role][]Permission{
	RoleUser:     userPerms,
	RoleReviewer: reviewerPerms,
	RoleAdmin:    append(slices.Clone(reviewerPerms), PermSeedIdeas, PermManagePlatform),
}

func HasPermission(r Role, p Permission) bool {
	return slices.Contains(RolePermissions[r], p)
}

// UserSession mirrors UserSession in types/auth.ts.
type UserSession struct {
	Token     string    `json:"token"`
	Username  string    `json:"username"`
	Name      string    `json:"name"`
	Role      Role      `json:"role"`
	AvatarURL string    `json:"avatarUrl"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// UserProfile mirrors UserProfile in types/index.ts. The BYOK API key is
// never returned; HasAPIKey tells the settings page whether one is stored.
type UserProfile struct {
	ID                  string     `json:"-"`
	Username            string     `json:"username"`
	Name                string     `json:"name"`
	AvatarURL           string     `json:"avatarUrl"`
	Headline            string     `json:"headline"`
	Bio                 string     `json:"bio"`
	GitHubURL           string     `json:"githubUrl"`
	PortfolioURL        string     `json:"portfolioUrl,omitempty"`
	PortfolioValidUntil *time.Time `json:"portfolioValidUntil"`
	Plan                string     `json:"plan"`
	HasAPIKey           bool       `json:"hasApiKey"`
	StatedSkills        []string   `json:"statedSkills"`
	Role                Role       `json:"role"`
	Email               string     `json:"email,omitempty"`
	UpdatedAt           time.Time  `json:"updatedAt"`

	// Onboarding fields. The settings form and the onboarding wizard both send
	// these; before migration 0005 they were accepted by neither the API nor the
	// schema, so a save failed outright and the choices were lost on reload.
	EngineeringTrack    string `json:"engineeringTrack,omitempty"`
	TargetRole          string `json:"targetRole,omitempty"`
	ExperienceLevel     string `json:"experienceLevel,omitempty"`
	GitHubUsername      string `json:"githubUsername,omitempty"`
	GitHubConnected     bool   `json:"githubConnected"`
	OnboardingCompleted bool   `json:"onboardingCompleted"`

	// ContactEmail is the address a dev wants recruiters to use, if not the one
	// they registered with. Empty means "use Email". Never surfaced publicly.
	ContactEmail string `json:"contactEmail"`

	// AuthProvider is the identity provider the account was created with:
	// "github", "google" or "". It is server-derived and not settable through
	// the profile update endpoint. Distinct from GitHubConnected, which tracks
	// a linked GitHub account and is user-settable.
	AuthProvider string `json:"authProvider"`
}

// Public strips fields that only the profile owner should see.
func (u UserProfile) Public() UserProfile {
	u.Email = ""
	// An address the dev chose for recruiter contact is still their address;
	// the public portfolio does not need to publish it.
	u.ContactEmail = ""
	u.HasAPIKey = false
	return u
}

// PlatformUser is the admin roster view of a dev. It carries the profile id,
// which UserProfile deliberately omits from every payload, because managing a
// role is addressed by id. Nothing else from the full profile is included.
type PlatformUser struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	AvatarURL string    `json:"avatarUrl"`
	Role      Role      `json:"role"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type MockEndpoint struct {
	Method         string          `json:"method"`
	Path           string          `json:"path"`
	Description    string          `json:"description"`
	ResponseSample json.RawMessage `json:"responseSample"`
}

type MockInfraSpec struct {
	BaseURL        string         `json:"baseUrl"`
	StarterRepoURL string         `json:"starterRepoUrl"`
	Endpoints      []MockEndpoint `json:"endpoints"`
	CurlExample    string         `json:"curlExample"`
	TestCriteria   []string       `json:"testCriteria"`
}

type Idea struct {
	ID                    string        `json:"id"`
	Title                 string        `json:"title"`
	Tagline               string        `json:"tagline"`
	Domain                string        `json:"domain"`
	Difficulty            string        `json:"difficulty"`
	EstimatedHours        int           `json:"estimatedHours"`
	OriginStory           string        `json:"originStory"`
	ProblemStatement      string        `json:"problemStatement"`
	TechnicalRequirements []string      `json:"technicalRequirements"`
	MockInfra             MockInfraSpec `json:"mockInfra"`
	Tags                  []string      `json:"tags"`
	SubmissionCount       int           `json:"submissionCount"`

	// Scraped problem fields.
	SuggestedStack  []string  `json:"suggestedStack"`
	RegionalHurdles string    `json:"regionalHurdles"`
	SourceURL       string    `json:"sourceUrl,omitempty"`
	AdminApproved   bool      `json:"adminApproved"`
	CreatedAt       time.Time `json:"createdAt"`

	// Launchpad state.
	Status          string     `json:"status"`
	ClaimedBy       *DevRef    `json:"claimedBy"`
	ClaimedAt       *time.Time `json:"claimedAt,omitempty"`
	StatusUpdatedAt time.Time  `json:"statusUpdatedAt"`
	CompletedAt     *time.Time `json:"completedAt,omitempty"`
}

// DevRef is a compact public reference to a developer.
type DevRef struct {
	ID        string `json:"-"`
	Username  string `json:"username"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatarUrl"`
}

// Problem statuses on the Launchpad.
const (
	StatusOpen                = "open"
	StatusInProgress          = "in_progress"
	StatusSeekingContributors = "seeking_contributors"
	StatusComplete            = "complete"
)

var ProblemStatuses = []string{StatusOpen, StatusInProgress, StatusSeekingContributors, StatusComplete}

// problems.status in the database uses Title Case labels.
var statusToDB = map[string]string{
	StatusOpen:                "Available",
	StatusInProgress:          "In Progress",
	StatusSeekingContributors: "Seeking Contributors",
	StatusComplete:            "Completed",
}

// StatusToDB converts an API problem status to its database label.
func StatusToDB(s string) string { return statusToDB[s] }

// StatusFromDB converts a database label to the API status. Unknown labels
// are passed through lowercased with underscores.
func StatusFromDB(s string) string {
	for api, db := range statusToDB {
		if strings.EqualFold(db, s) {
			return api
		}
	}
	return strings.ReplaceAll(strings.ToLower(strings.TrimSpace(s)), " ", "_")
}

// Claim (claimed_projects.collaboration_status) values.
const (
	ClaimActive    = "Active"
	ClaimCompleted = "Completed"
)

// RoleFromDB maps profiles.role onto an API role; the database default
// "candidate" (and anything unknown) is a regular user.
func RoleFromDB(s string) Role {
	if r := Role(s); r == RoleReviewer || r == RoleAdmin {
		return r
	}
	return RoleUser
}

// RoleToDB maps an API role onto the profiles.role value.
func RoleToDB(r Role) string {
	if r == RoleUser {
		return "candidate"
	}
	return string(r)
}

var (
	Plans     = []string{"free", "full-service", "byok"}
	JobTypes  = []string{"Full-time", "Part-time", "Contract", "Internship", "Remote"}
	JobLevels = []string{"intern", "junior", "mid", "senior", "lead", "unspecified"}
)

type TestResults struct {
	Passed    int    `json:"passed"`
	Total     int    `json:"total"`
	SuiteName string `json:"suiteName"`
}

type Metrics struct {
	LatencyP99 string `json:"latencyP99,omitempty"`
	Throughput string `json:"throughput,omitempty"`
	Coverage   string `json:"coverage,omitempty"`
}

func (m *Metrics) Empty() bool {
	return m == nil || (m.LatencyP99 == "" && m.Throughput == "" && m.Coverage == "")
}

// Certificate is the 365-day ledger stamp issued when a submission is verified.
type Certificate struct {
	Hash       string    `json:"hash"`
	IssuedAt   time.Time `json:"issuedAt"`
	ValidUntil time.Time `json:"validUntil"`
}

// Submission mirrors SubmissionEntry in types/index.ts, plus ledger extras.
type Submission struct {
	Hash              string       `json:"hash"`
	IdeaID            string       `json:"ideaId"`
	IdeaTitle         string       `json:"ideaTitle"`
	AuthorUsername    string       `json:"authorUsername"`
	AuthorName        string       `json:"authorName"`
	AuthorAvatar      string       `json:"authorAvatar,omitempty"`
	RepoURL           string       `json:"repoUrl"`
	DemoURL           string       `json:"demoUrl,omitempty"`
	CommitHash        string       `json:"commitHash,omitempty"`
	PRNumber          *int         `json:"prNumber,omitempty"`
	ArchitectureNotes string       `json:"architectureNotes"`
	Timestamp         time.Time    `json:"timestamp"`
	Status            string       `json:"status"`
	TestResults       TestResults  `json:"testResults"`
	Metrics           *Metrics     `json:"metrics,omitempty"`
	ReviewNotes       string       `json:"reviewNotes,omitempty"`
	Certificate       *Certificate `json:"certificate,omitempty"`
}

type Job struct {
	ID             string   `json:"id"`
	Title          string   `json:"title"`
	Company        string   `json:"company"`
	Location       string   `json:"location"`
	Type           string   `json:"type"`
	Salary         string   `json:"salary"`
	Tags           []string `json:"tags"`
	MatchScore     int      `json:"matchScore"`
	MatchedIdeaIDs []string `json:"matchedIdeaIds"`
	RequiredSkills []string `json:"requiredSkills"`
	Description    string   `json:"description"`
	GapIdeaID      string   `json:"gapIdeaId,omitempty"`
	GapReason      string   `json:"gapReason,omitempty"`

	Level         string     `json:"level"`
	ApplyURL      string     `json:"applyUrl"`
	AdminApproved bool       `json:"adminApproved"`
	IsActive      bool       `json:"isActive"`
	SourceURL     string     `json:"sourceUrl,omitempty"`
	PostedAt      *time.Time `json:"postedAt,omitempty"`
	ScrapedAt     *time.Time `json:"scrapedAt,omitempty"`
	// DeletedAt marks a job removed by an admin. Only the moderation list
	// returns them; every public read path filters them out.
	DeletedAt *time.Time `json:"deletedAt,omitempty"`
}

// JobMatch explains how well a job fits a developer's skills.
type JobMatch struct {
	Score         int      `json:"score"`
	MatchedSkills []string `json:"matchedSkills"`
	MissingSkills []string `json:"missingSkills"`
}

// IdeaMatch explains how well a problem fits a developer's skills. Score is
// the skill overlap, on the same 0-100 scale as JobMatch; DifficultyFit adds a
// small seniority-vs-difficulty adjustment (0-10) used for ranking only.
type IdeaMatch struct {
	Score         int      `json:"score"`
	MatchedSkills []string `json:"matchedSkills"`
	MissingSkills []string `json:"missingSkills"`
	DifficultyFit int      `json:"difficultyFit"`
}

// ExperienceLevels are the onboarding seniority levels, mirroring
// ExperienceLevel in frontend/src/types/index.ts.
var ExperienceLevels = []string{"junior", "mid", "senior", "lead"}

// EngineeringTracks are the onboarding specializations, mirroring the keys of
// ENGINEERING_TRACKS in frontend/src/lib/tracks.ts and the EngineeringTrack
// union in frontend/src/types/index.ts. The API validates against this list
// rather than accepting any string, so a typo in the form is reported instead
// of stored.
var EngineeringTracks = []string{
	"devops-infra",
	"backend-systems",
	"frontend-ui",
	"fullstack",
	"product-design",
	"ai-ml",
	"mobile",
}

// ATSBreakdownItem scores one dimension of a CV.
type ATSBreakdownItem struct {
	Category string `json:"category"`
	Score    int    `json:"score"`
	Notes    string `json:"notes"`
}

type ATSRecommendation struct {
	Category   string `json:"category"`
	Priority   string `json:"priority"` // high | medium | low
	Issue      string `json:"issue"`
	Suggestion string `json:"suggestion"`
}

// CVAudit is a stored ATS compliance audit.
type CVAudit struct {
	ID              string              `json:"id"`
	DevUsername     string              `json:"devUsername"`
	JobID           string              `json:"jobId,omitempty"`
	Score           int                 `json:"score"`
	Summary         string              `json:"summary"`
	Breakdown       []ATSBreakdownItem  `json:"breakdown"`
	Recommendations []ATSRecommendation `json:"recommendations"`
	MatchedKeywords []string            `json:"matchedKeywords"`
	MissingKeywords []string            `json:"missingKeywords"`
	Engine          string              `json:"engine"` // claude | heuristic
	Model           string              `json:"model,omitempty"`
	CVChars         int                 `json:"cvChars"`
	CreatedAt       time.Time           `json:"createdAt"`
}

type Milestone struct {
	Week        int      `json:"week"`
	Title       string   `json:"title"`
	Deliverable string   `json:"deliverable"`
	IdeaIDRef   string   `json:"ideaIdRef,omitempty"`
	Prompts     []string `json:"prompts"`
}

type CoachingItinerary struct {
	ID            string      `json:"id"`
	Title         string      `json:"title"`
	Subtitle      string      `json:"subtitle"`
	TargetRole    string      `json:"targetRole"`
	DurationWeeks int         `json:"durationWeeks"`
	Milestones    []Milestone `json:"milestones"`
}
