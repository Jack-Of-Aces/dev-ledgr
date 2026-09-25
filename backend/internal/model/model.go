// Package model defines the API wire types. Field names and shapes mirror the
// frontend contracts in frontend/src/types so responses can be consumed as-is.
package model

import (
	"encoding/json"
	"slices"
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
)

var userPerms = []Permission{
	PermViewIdeas, PermSubmitSolution, PermViewJobs, PermApplyJob,
	PermViewCoaching, PermRunAICoach, PermEditOwnProfile,
}

// RolePermissions mirrors ROLE_PERMISSIONS in frontend/src/types/auth.ts.
var RolePermissions = map[Role][]Permission{
	RoleUser:     userPerms,
	RoleReviewer: append(slices.Clone(userPerms), PermReviewSubmissions, PermStampSolution),
	RoleAdmin:    append(slices.Clone(userPerms), PermReviewSubmissions, PermStampSolution, PermSeedIdeas, PermManagePlatform),
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
	PortfolioValidUntil *time.Time `json:"portfolioValidUntil"`
	Plan                string     `json:"plan"`
	HasAPIKey           bool       `json:"hasApiKey"`
	StatedSkills        []string   `json:"statedSkills"`
	Role                Role       `json:"role"`
	Email               string     `json:"email,omitempty"`
	UpdatedAt           time.Time  `json:"updatedAt"`
}

// Public strips fields that only the profile owner should see.
func (u UserProfile) Public() UserProfile {
	u.Email = ""
	u.HasAPIKey = false
	return u
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
}

var (
	Domains      = []string{"fintech", "systems", "logistics", "ai", "security", "devtools"}
	Difficulties = []string{"foundational", "intermediate", "production-grade"}
	Plans        = []string{"free", "full-service", "byok"}
	JobTypes     = []string{"Full-time", "Contract", "Remote"}
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
