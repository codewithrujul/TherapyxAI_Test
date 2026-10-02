/**
 * Therapy Knowledge Base
 * Sources: NIMH, WHO MH Gap, Beck Institute CBT, DBT Linehan, ACT Hayes,
 *          SAMHSA Crisis Protocols, iCall India, NIMHANS India
 *
 * Languages: English, Hindi (हिंदी), Marathi (मराठी)
 * Usage: Pass THERAPY_KNOWLEDGE_BASE into ingestDocuments()
 */

export interface KBDocument {
    content: string;
    metadata: {
        source: string;
        category: string;
        language: "en" | "hi" | "mr";
        type: "psychoeducation" | "technique" | "crisis" | "grounding" | "overview" | "cultural";
        severity?: "low" | "medium" | "high" | "crisis";
        tags: string[];
    };
}

export const THERAPY_KNOWLEDGE_BASE: KBDocument[] = [

    // ─────────────────────────────────────────────────────────────────
    // SECTION 1: CRISIS DETECTION & RESPONSE (HIGHEST PRIORITY)
    // ─────────────────────────────────────────────────────────────────

    {
        content: `CRISIS PROTOCOL — SUICIDAL IDEATION DETECTION AND RESPONSE

If a user expresses any of the following, treat it as a crisis situation:
- "I want to die", "I want to kill myself", "I don't want to live anymore"
- "Everyone would be better off without me"
- "I've been thinking about ending it"
- "I have a plan to hurt myself"
- "I've been stockpiling pills / I have a weapon"
- Giving away belongings, saying goodbye to people

IMMEDIATE RESPONSE PROTOCOL:
1. Acknowledge their pain with warmth — never dismiss or minimize
2. Ask directly: "Are you thinking about suicide?" (direct questioning does NOT increase risk)
3. Stay calm — your calmness is stabilizing for them
4. Do NOT leave them alone in conversation
5. Do NOT promise confidentiality if life is at risk

WHAT TO SAY:
"I hear how much pain you're in right now. Thank you for trusting me with this. You don't have to face this alone."
"I'm concerned about your safety. Are you thinking about ending your life?"
"I want to make sure you're safe. Can we talk about getting you some immediate support?"

CRISIS RESOURCES TO SHARE (INDIA):
- iCall (TISS): 9152987821 — Mon–Sat, 8am–10pm
- Vandrevala Foundation: 1860-2662-345 — 24/7, free, multilingual
- AASRA: 9820466627 — 24/7
- iCall WhatsApp: +91 9152987821
- Emergency: 112

WARNING SIGNS OF IMMINENT RISK:
- Specific plan + means available
- Previous attempts (highest predictor)
- Recent major loss (job, relationship, death)
- Social isolation + hopelessness together
- Sudden calmness after depression (may indicate decision made)`,
        metadata: {
            source: "SAMHSA Crisis Protocols + iCall India + NIMHANS",
            category: "crisis",
            language: "en",
            type: "crisis",
            severity: "crisis",
            tags: ["suicide", "crisis", "emergency", "safety", "hotline", "ideation", "self-harm"]
        }
    },

    {
        content: `CRISIS PROTOCOL — SELF HARM (NON-SUICIDAL)

Non-suicidal self-injury (NSSI) includes cutting, burning, hitting oneself, scratching to bleed.
It is usually a coping mechanism for overwhelming emotions — NOT attention-seeking.

WHAT THE PERSON IS COMMUNICATING:
- "I am in emotional pain I cannot express any other way"
- "I need to feel something / feel in control"
- "I need to release overwhelming tension"

HOW TO RESPOND:
1. Stay calm — do not express shock or disgust
2. Thank them for telling you
3. Do not demand they stop immediately — this removes their only coping tool without replacing it
4. Explore what happened before the urge
5. Offer alternative coping strategies together

WHAT TO SAY:
"Thank you for trusting me with this. It sounds like you're dealing with a lot of pain."
"Can you tell me what was happening just before you felt the urge?"
"I'd like to help you find other ways to manage this feeling — when you're ready."

SAFE MESSAGING GUIDELINES:
- Do NOT describe methods in detail
- Do NOT express moral judgment
- Do NOT threaten to disconnect unless immediate danger
- DO validate the emotion underneath the behavior
- DO encourage professional support

ALTERNATIVE COPING STRATEGIES TO SUGGEST:
- Hold ice cubes (physical sensation without damage)
- Snap a rubber band on wrist
- Intense exercise (run, jump)
- Draw on skin with red marker
- Tear paper or newspaper aggressively
- Call a crisis line to talk through the urge

REFER TO PROFESSIONAL IF:
- Wounds require medical attention
- Frequency is increasing
- Person expresses desire to die`,
        metadata: {
            source: "SAMHSA + Safe Messaging Guidelines + NIMHANS",
            category: "crisis",
            language: "en",
            type: "crisis",
            severity: "crisis",
            tags: ["self-harm", "NSSI", "cutting", "crisis", "coping", "emotional-pain"]
        }
    },

    {
        content: `संकट प्रोटोकॉल — आत्महत्या के विचार (CRISIS — SUICIDAL IDEATION IN HINDI)

अगर कोई व्यक्ति इस तरह की बातें कहे तो तुरंत संकट की स्थिति मानें:
- "मैं मरना चाहता/चाहती हूं"
- "मेरे बिना सब बेहतर होंगे"
- "मैं जीना नहीं चाहता/चाहती"
- "मैंने सोच लिया है क्या करना है"

क्या कहें:
"मैं समझ सकता/सकती हूं कि आप अभी बहुत दर्द में हैं। मुझे बताने के लिए शुक्रिया।"
"क्या आप खुद को नुकसान पहुंचाने के बारे में सोच रहे हैं? मैं आपकी मदद करना चाहता/चाहती हूं।"
"आप अकेले नहीं हैं। हम साथ मिलकर इसका हल ढूंढेंगे।"

भारत में तुरंत मदद के लिए:
- iCall (TISS): 9152987821 — सोम-शनि, सुबह 8 बजे से रात 10 बजे तक
- Vandrevala Foundation: 1860-2662-345 — 24 घंटे, मुफ़्त, हिंदी में उपलब्ध
- AASRA: 9820466627 — 24 घंटे
- आपातकाल: 112

याद रखें: सीधे पूछना कि "क्या आप आत्महत्या के बारे में सोच रहे हैं?" — यह जोखिम नहीं बढ़ाता, बल्कि मदद करता है।`,
        metadata: {
            source: "iCall India + NIMHANS Hindi Resources",
            category: "crisis",
            language: "hi",
            type: "crisis",
            severity: "crisis",
            tags: ["suicide", "crisis", "hindi", "आत्महत्या", "संकट", "hotline"]
        }
    },

    {
        content: `संकट प्रोटोकॉल — आत्महत्येचे विचार (CRISIS — SUICIDAL IDEATION IN MARATHI)

जर कोणी खालील गोष्टी बोलत असेल तर ताबडतोब संकट म्हणून समजा:
- "मला मरायचे आहे"
- "माझ्याशिवाय सगळे बरे राहतील"
- "मला जगणे नको आहे"
- "मी काय करायचे ते ठरवले आहे"

काय बोलावे:
"तुम्ही खूप वेदनेत आहात हे मला जाणवते. मला सांगितल्याबद्दल आभारी आहे."
"तुम्ही स्वतःला इजा करण्याचा विचार करत आहात का? मी तुम्हाला मदत करायला इथे आहे."
"तुम्ही एकटे नाही आहात. आपण एकत्र मार्ग शोधू."

भारतात तातडीची मदत:
- iCall (TISS): 9152987821 — सोम-शनि, सकाळी 8 ते रात्री 10
- Vandrevala Foundation: 1860-2662-345 — 24 तास, मोफत, मराठीत उपलब्ध
- AASRA: 9820466627 — 24 तास
- आणीबाणी: 112

लक्षात ठेवा: थेट विचारणे — "तुम्हाला आत्महत्येचे विचार येत आहेत का?" — हे धोका वाढवत नाही, उलट मदत करते.`,
        metadata: {
            source: "iCall India + NIMHANS Marathi Resources",
            category: "crisis",
            language: "mr",
            type: "crisis",
            severity: "crisis",
            tags: ["suicide", "crisis", "marathi", "आत्महत्या", "संकट", "hotline"]
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // SECTION 2: ANXIETY — ENGLISH
    // ─────────────────────────────────────────────────────────────────

    {
        content: `UNDERSTANDING ANXIETY — Psychoeducation

What is anxiety?
Anxiety is your body's natural alarm system — it evolved to protect you from danger. When your brain perceives a threat (real or imagined), it triggers the "fight-or-flight" response: heart rate increases, breathing quickens, muscles tense. This is normal and helpful in genuine danger.

Anxiety becomes a problem when:
- The alarm goes off when there's no real threat
- It's disproportionately intense compared to the situation
- It persists long after the threat is gone
- It interferes with daily life, work, or relationships

Common anxiety disorders:
- Generalized Anxiety Disorder (GAD) — persistent worry about many things
- Social Anxiety — intense fear of social situations and judgment
- Panic Disorder — recurring unexpected panic attacks
- Health Anxiety — excessive worry about having a serious illness
- OCD — unwanted intrusive thoughts + compulsive behaviors

Physical symptoms of anxiety:
Pounding heart, shortness of breath, chest tightness, sweating, trembling, dizziness, nausea, stomach upset, headache, fatigue, trouble sleeping

What helps:
- Deep breathing activates the parasympathetic nervous system (calms the alarm)
- Regular exercise reduces baseline anxiety by 40-60% (research-backed)
- Reducing caffeine and alcohol
- Sleep hygiene — anxiety and poor sleep feed each other
- Therapy (CBT is gold standard for anxiety)
- Medication if recommended by psychiatrist`,
        metadata: {
            source: "NIMH Anxiety Disorders + Beck Institute",
            category: "anxiety",
            language: "en",
            type: "psychoeducation",
            severity: "medium",
            tags: ["anxiety", "worry", "fear", "panic", "fight-or-flight", "GAD", "social-anxiety", "psychoeducation"]
        }
    },

    {
        content: `ANXIETY MANAGEMENT TECHNIQUES

1. BOX BREATHING (4-4-4-4)
Used by Navy SEALs to calm under pressure.
- Inhale for 4 counts
- Hold for 4 counts
- Exhale for 4 counts
- Hold for 4 counts
- Repeat 4–6 times
Effect: Activates vagus nerve, slows heart rate within 90 seconds.

2. 5-4-3-2-1 GROUNDING (for panic or dissociation)
- 5 things you can SEE
- 4 things you can TOUCH (feel their texture)
- 3 things you can HEAR
- 2 things you can SMELL
- 1 thing you can TASTE
This technique anchors you in the present moment and interrupts the anxiety spiral.

3. PROGRESSIVE MUSCLE RELAXATION (PMR)
Tense each muscle group for 5 seconds, then release for 30 seconds.
Start from feet → calves → thighs → abdomen → hands → arms → shoulders → face.
Takes 15–20 minutes. Do before sleep for best effect on anxiety and insomnia.

4. COGNITIVE RESTRUCTURING FOR ANXIETY
When anxious thoughts arise, ask:
- "What is the actual evidence for this fear?"
- "What is the worst realistic outcome? Could I handle it?"
- "Am I predicting disaster without evidence? (Catastrophizing)"
- "What would I tell a good friend in this situation?"

5. WORRY POSTPONEMENT
Schedule 20 minutes as "worry time" each day. When anxious thoughts arise outside this window, write them down and tell yourself "I'll think about this at worry time." This contains anxiety without suppressing it.

6. BEHAVIORAL EXPOSURE (for avoidance)
Avoidance maintains anxiety. Gradual, systematic exposure to feared situations reduces anxiety over time. Build a "fear ladder" from least to most scary and climb it slowly.`,
        metadata: {
            source: "Beck Institute CBT + NIMH + Barlow Anxiety Treatment",
            category: "anxiety",
            language: "en",
            type: "technique",
            severity: "medium",
            tags: ["anxiety", "breathing", "grounding", "5-4-3-2-1", "box-breathing", "PMR", "CBT", "exposure", "panic"]
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // SECTION 3: DEPRESSION — ENGLISH
    // ─────────────────────────────────────────────────────────────────

    {
        content: `UNDERSTANDING DEPRESSION — Psychoeducation

Depression is not weakness, laziness, or a character flaw. It is a medical condition that affects brain chemistry, thought patterns, and behavior. It is one of the most common and treatable mental health conditions in the world.

Core symptoms (must have for 2+ weeks):
- Persistent low mood / sadness / emptiness
- Loss of interest or pleasure in activities once enjoyed (anhedonia)

Additional symptoms:
- Fatigue and loss of energy
- Changes in appetite (eating much more or much less)
- Sleep disturbance (insomnia or sleeping too much)
- Difficulty concentrating or making decisions
- Feelings of worthlessness or excessive guilt
- Psychomotor changes (moving or speaking more slowly)
- Thoughts of death or suicide

The depression trap:
Depression tells you "nothing will help, so don't try." But inactivity deepens depression. This is why behavioral activation (doing things even when you don't feel like it) is powerful — action often comes BEFORE motivation in depression, not after.

What causes depression:
- Biological: genetics, brain chemistry (serotonin, dopamine, norepinephrine)
- Psychological: negative thinking patterns, low self-esteem, trauma history
- Social: isolation, relationship problems, loss, work stress
- Physical: chronic illness, hormonal changes, certain medications

What helps:
- Therapy (CBT, IPT, and behavioral activation are all evidence-based)
- Medication (antidepressants) — often most effective combined with therapy
- Exercise (equivalent to antidepressant for mild-moderate depression)
- Social connection (isolation worsens depression)
- Sleep and nutrition regulation
- Light therapy (for seasonal depression)`,
        metadata: {
            source: "NIMH Depression + WHO MH Gap + APA",
            category: "depression",
            language: "en",
            type: "psychoeducation",
            severity: "medium",
            tags: ["depression", "sadness", "anhedonia", "mood", "worthlessness", "psychoeducation", "treatment"]
        }
    },

    {
        content: `BEHAVIORAL ACTIVATION FOR DEPRESSION

Core idea: Depression reduces activity → reduced activity deepens depression. Break the cycle by scheduling activities even before you "feel like it."

STEP 1: ACTIVITY MONITORING
For one week, track:
- What you did each hour
- Your mood (0-10) before and after
- Your enjoyment (0-10) and sense of accomplishment (0-10)
Patterns will emerge — some activities reliably lift mood even slightly.

STEP 2: ACTIVITY SCHEDULING
Schedule 2–3 small activities per day from three categories:
a) Pleasure activities — things that used to bring enjoyment (even small ones: a cup of tea, a walk, music)
b) Mastery activities — tasks that give a sense of accomplishment (cleaning a room, finishing a small task)
c) Social activities — even minimal connection (texting a friend, sitting with family)

STEP 3: COPE WITH AVOIDANCE
Depression causes avoidance. When avoidance urges hit:
- Break the task into the SMALLEST possible step ("I will just put on shoes")
- Act opposite to the urge — if you want to stay in bed, sit up first
- Remember: motivation follows action in depression, not the other way around

STEP 4: TRACK PROGRESS
Notice small improvements. Depression distorts perception — you may be doing better than you think. A mood journal makes this visible.

VALUES-BASED ACTIVATION:
Ask "What kind of person do I want to be? What matters to me?" Then act consistently with those values even when mood is low. This is the ACT approach to depression.`,
        metadata: {
            source: "Lewinsohn Behavioral Activation + Martell BA for Depression + ACT Hayes",
            category: "depression",
            language: "en",
            type: "technique",
            severity: "medium",
            tags: ["depression", "behavioral-activation", "activity", "scheduling", "avoidance", "mood", "CBT"]
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // SECTION 4: STRESS MANAGEMENT — ENGLISH
    // ─────────────────────────────────────────────────────────────────

    {
        content: `STRESS MANAGEMENT — Understanding and Coping

What is stress?
Stress is the body's response to demands that exceed perceived resources. Short-term stress can enhance performance (eustress). Chronic stress damages physical and mental health.

Physical effects of chronic stress:
- Weakened immune system
- Cardiovascular disease risk
- Digestive problems (IBS, ulcers)
- Headaches and muscle tension
- Hormonal disruption (cortisol dysregulation)
- Sleep disruption

Psychological effects:
- Anxiety and depression
- Difficulty concentrating
- Irritability and mood swings
- Burnout
- Relationship strain

PROBLEM-FOCUSED COPING (when you CAN change the stressor):
1. Identify the specific stressor clearly
2. Break it into smaller manageable parts
3. Make an action plan with specific steps
4. Set boundaries — learn to say no
5. Time management: prioritize, delegate, eliminate

EMOTION-FOCUSED COPING (when you CANNOT change the stressor):
1. Deep breathing and relaxation
2. Mindfulness — be present without judgment
3. Expressive writing — write feelings without censorship for 15 min
4. Social support — talk to trusted people
5. Exercise — burns stress hormones directly
6. Meaning-making — find perspective and growth

WORK-RELATED STRESS (common in India):
- Long hours, job insecurity, poor work-life balance
- Set "end of work" rituals to psychologically switch off
- Communicate needs to supervisors (assertively)
- Identify what is and isn't in your control`,
        metadata: {
            source: "WHO Stress Management + Lazarus Coping Theory + APA",
            category: "stress",
            language: "en",
            type: "psychoeducation",
            severity: "low",
            tags: ["stress", "coping", "burnout", "work-stress", "cortisol", "relaxation", "problem-solving"]
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // SECTION 5: RELATIONSHIPS & GRIEF — ENGLISH
    // ─────────────────────────────────────────────────────────────────

    {
        content: `GRIEF AND LOSS — Psychoeducation and Support

Grief is a natural response to loss — not just death, but also loss of relationship, job, health, identity, or any significant change. Grief is not a disorder; it is the price of love.

The Kübler-Ross stages (not a rigid sequence — people move between them):
1. Denial — "This can't be happening"
2. Anger — "Why me? This is unfair"
3. Bargaining — "If only I had..."
4. Depression — deep sadness, withdrawal, missing the person/thing
5. Acceptance — not "it's okay" but "this is now my reality"

What grief actually looks like:
- Intense waves of emotion — sadness, anger, guilt, relief, numbness
- Physical symptoms — fatigue, chest pain, loss of appetite
- Cognitive fog — difficulty concentrating or making decisions
- Social withdrawal
- Yearning and intrusive memories

There is NO timeline for grief. Telling someone to "move on" is harmful. Allow the grief.

WHAT HELPS IN GRIEF:
- Allow yourself to feel — suppressing grief prolongs it
- Talk about the person/loss — stories keep memories alive
- Maintain some structure and routine
- Accept support from others (don't isolate)
- Create rituals — lighting a candle, visiting a place
- Give yourself permission to have good days without guilt
- Seek therapy if grief is interfering with daily function after several months

COMPLICATED GRIEF (when to refer):
- Prolonged intense grief beyond 12 months
- Unable to function at all
- Thoughts of suicide to be with the deceased
- Complete avoidance of all reminders`,
        metadata: {
            source: "Kübler-Ross + Worden Grief Tasks + APA Grief Guidelines",
            category: "grief",
            language: "en",
            type: "psychoeducation",
            severity: "medium",
            tags: ["grief", "loss", "death", "bereavement", "mourning", "stages-of-grief", "complicated-grief"]
        }
    },

    {
        content: `RELATIONSHIP DIFFICULTIES — Communication and Boundaries

Common relationship problems:
- Poor communication (not listening, assuming, criticizing)
- Unresolved conflict that builds resentment
- Lack of emotional intimacy
- Trust issues (jealousy, past betrayal)
- Power imbalance
- Different expectations (family, financial, lifestyle)

In India specifically:
- Arranged marriage adjustment difficulties
- Joint family conflicts (in-law relationships)
- Pressure around marriage timing and decisions
- LGBTQ+ relationship challenges within family systems
- Intergenerational conflict around values

ASSERTIVE COMMUNICATION (not aggressive, not passive):
Use "I statements" instead of "You statements"
Wrong: "You never listen to me"
Right: "I feel unheard when I'm interrupted. I need space to finish my thoughts."

ACTIVE LISTENING:
- Give full attention (no phone)
- Reflect back: "What I hear you saying is..."
- Ask before advising: "Do you want advice or just to be heard?"
- Validate before responding: "That sounds really frustrating"

HEALTHY BOUNDARIES:
- Boundaries are about your behavior, not controlling others
- "I won't engage in conversations where I'm being yelled at"
- "I need 30 minutes alone when I get home before talking"
- Boundaries require communication AND consistent follow-through

TOXIC RELATIONSHIP SIGNS:
- Consistent disrespect, contempt, or humiliation
- Control and isolation from friends/family
- Fear of partner's reactions
- Physical, emotional, or financial abuse
If any of these are present, encourage professional support and safety planning.`,
        metadata: {
            source: "Gottman Institute + IPT + iCall India Relationship Resources",
            category: "relationships",
            language: "en",
            type: "psychoeducation",
            severity: "medium",
            tags: ["relationships", "communication", "boundaries", "conflict", "marriage", "family", "assertiveness", "India"]
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // SECTION 6: SLEEP — ENGLISH
    // ─────────────────────────────────────────────────────────────────

    {
        content: `SLEEP PROBLEMS — Understanding and Sleep Hygiene

Sleep and mental health are deeply connected. Poor sleep worsens anxiety, depression, and emotional regulation. Treating sleep often significantly improves mental health.

How much sleep is needed:
- Adults: 7–9 hours
- Teenagers: 8–10 hours
- Older adults: 7–8 hours (but architecture changes with age)

Common sleep problems:
- Insomnia — difficulty falling or staying asleep
- Hypersomnia — sleeping too much (often in depression)
- Nightmares / disturbed sleep (common in PTSD, anxiety)
- Disrupted circadian rhythm (shift work, phone use at night)

SLEEP HYGIENE (CBT-I principles — most effective treatment for insomnia):

DO:
- Keep consistent wake time — even weekends (most important rule)
- Use bed ONLY for sleep and sex — not work, phone, or TV
- Create a wind-down routine 30-60 min before bed (dim lights, no screens, calm activity)
- Keep bedroom cool, dark, and quiet
- Get morning sunlight within 1 hour of waking (resets circadian clock)
- Exercise regularly — but not within 3 hours of bedtime

DON'T:
- Check the clock when awake at night (causes anxiety)
- Lie in bed awake for more than 20 min — get up, do something calm, return when sleepy
- Nap during the day if you have insomnia
- Caffeine after 2pm
- Alcohol before bed (disrupts sleep architecture)
- Screens 1 hour before bed (blue light suppresses melatonin)

COGNITIVE APPROACHES:
- Challenge catastrophic thoughts about sleep ("If I don't sleep I'll ruin tomorrow")
- Practice acceptance — trying to force sleep makes it worse
- Paradoxical intention: "I will try to stay awake" (removes performance anxiety)`,
        metadata: {
            source: "CBT-I Harvey + AASM Sleep Guidelines + NIMH Sleep",
            category: "sleep",
            language: "en",
            type: "technique",
            severity: "low",
            tags: ["sleep", "insomnia", "sleep-hygiene", "CBT-I", "circadian", "melatonin", "nightmares"]
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // SECTION 7: MINDFULNESS & GROUNDING — ENGLISH
    // ─────────────────────────────────────────────────────────────────

    {
        content: `MINDFULNESS — What It Is and How to Practice

Mindfulness is paying attention to the present moment intentionally, without judgment. It is not about emptying the mind — thoughts will arise. Mindfulness is noticing them without getting pulled in.

Scientific benefits (meta-analyses):
- Reduces anxiety by 30–40%
- Reduces depression relapse by 50%
- Improves emotional regulation
- Reduces chronic pain
- Improves immune function
- Reduces rumination

BASIC BREATH AWARENESS (5 minutes):
1. Sit comfortably, close eyes or soft gaze downward
2. Notice the physical sensation of breathing — the air entering nostrils, the rise of the chest or belly
3. When mind wanders (it will, constantly — this is normal), gently bring attention back to breath
4. No judgment — wandering and returning IS the practice
5. Start with 5 minutes daily; build to 15–20 minutes

BODY SCAN MEDITATION (10–15 minutes):
Slowly move attention through the body from toes to head.
Notice sensations without trying to change them — warmth, tingling, tension, numbness.
Particularly helpful for people who dissociate from their body due to trauma.

MINDFUL DAILY ACTIVITIES:
You don't need to sit to be mindful.
- Mindful eating: notice taste, texture, temperature, smell
- Mindful walking: feel each footstep, notice surroundings
- Mindful listening: fully attend to whoever is speaking

COMMON MISTAKES:
- "I'm not doing it right" — there is no wrong way
- "I can't stop my thoughts" — you're not supposed to stop them
- Expecting immediate results — benefits accumulate over weeks
- Doing it only when anxious — daily practice builds the skill`,
        metadata: {
            source: "MBSR Kabat-Zinn + MBCT Segal Williams + ACT Hayes",
            category: "mindfulness",
            language: "en",
            type: "technique",
            severity: "low",
            tags: ["mindfulness", "meditation", "breathing", "MBSR", "MBCT", "present-moment", "awareness", "body-scan"]
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // SECTION 8: TRAUMA — ENGLISH
    // ─────────────────────────────────────────────────────────────────

    {
        content: `TRAUMA AND PTSD — Understanding and Support

What is trauma?
Trauma is any experience that overwhelms a person's ability to cope, leaving lasting effects on their nervous system, sense of safety, and sense of self. Trauma is about the impact on the person, not just the event.

Types of trauma:
- Single-incident trauma (accident, assault, natural disaster)
- Complex trauma (ongoing abuse, neglect, domestic violence)
- Developmental trauma (adverse childhood experiences)
- Secondary/vicarious trauma (from witnessing or hearing about trauma)
- Collective trauma (community disasters, violence, pandemic)

Common PTSD symptoms:
- Re-experiencing: flashbacks, nightmares, intrusive memories
- Avoidance: staying away from reminders, emotional numbing
- Hyperarousal: always on guard, exaggerated startle, sleep problems, irritability
- Negative cognitions: "I am damaged", "I can't trust anyone", persistent guilt or shame

TRAUMA-INFORMED RESPONSES:
Always prioritize: Safety, Trustworthiness, Choice, Collaboration, Empowerment
- Never push someone to disclose more than they want to
- Never minimize ("others have it worse")
- Avoid: "Just let it go", "It happened so long ago"
- Do: "That sounds incredibly hard. You survived something very difficult."

GROUNDING FOR TRAUMA FLASHBACKS:
When flashback hits:
1. Say aloud: "I am [name]. It is [date]. I am in [place]. I am safe right now."
2. Feel your feet on the floor — press them down firmly
3. Hold something cold or textured
4. Name 5 things you can see in the room
5. Slow exhale (longer than inhale) to activate parasympathetic system

TREATMENT OPTIONS:
- EMDR (Eye Movement Desensitization and Reprocessing) — highly effective
- Trauma-focused CBT
- Somatic therapies (body-based)
- MDMA-assisted therapy (emerging research)
Note: Trauma treatment should be conducted by a trained professional.`,
        metadata: {
            source: "APA Trauma Guidelines + van der Kolk Body Keeps the Score + ISTSS",
            category: "trauma",
            language: "en",
            type: "psychoeducation",
            severity: "high",
            tags: ["trauma", "PTSD", "flashback", "abuse", "ACE", "EMDR", "grounding", "safety", "nervous-system"]
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // SECTION 9: HINDI — ANXIETY, DEPRESSION, GENERAL
    // ─────────────────────────────────────────────────────────────────

    {
        content: `चिंता को समझना — मनोशिक्षा (ANXIETY IN HINDI)

चिंता क्या है?
चिंता आपके शरीर की प्राकृतिक अलार्म प्रणाली है। जब मस्तिष्क को कोई खतरा महसूस होता है — चाहे वो असली हो या काल्पनिक — तो वो "लड़ो या भागो" की प्रतिक्रिया चालू करता है।

चिंता के लक्षण:
- दिल तेज़ धड़कना
- सांस लेने में तकलीफ़
- पसीना आना
- कांपना या थरथराना
- पेट में गड़बड़ी
- नींद न आना
- हर समय बुरा सोचते रहना

चिंता कब समस्या बन जाती है?
- जब वो बिना कारण के हो
- जब ज़िंदगी, काम या रिश्तों में परेशानी आए
- जब आप चीज़ें टालने लगें (avoidance)

चिंता कम करने के उपाय:

1. बॉक्स ब्रीदिंग:
4 सेकंड सांस लें → 4 सेकंड रोकें → 4 सेकंड छोड़ें → 4 सेकंड रोकें
4-6 बार दोहराएं।

2. 5-4-3-2-1 ग्राउंडिंग (जब घबराहट बहुत बढ़ जाए):
5 चीज़ें जो आप देख सकते हैं
4 चीज़ें जो आप छू सकते हैं
3 चीज़ें जो आप सुन सकते हैं
2 चीज़ें जो आप सूंघ सकते हैं
1 चीज़ जो आप चख सकते हैं

3. सोच को चुनौती दें:
जब डर लगे, खुद से पूछें:
"क्या इसके पक्ष में कोई सबूत है?"
"सबसे बुरा क्या होगा और क्या मैं उसे झेल सकता/सकती हूं?"

4. व्यायाम — रोज़ 30 मिनट चलना भी चिंता को काफी कम करता है।

याद रखें: चिंता एक बीमारी है, कमज़ोरी नहीं। इसका इलाज होता है।`,
        metadata: {
            source: "NIMH Hindi Resources + iCall India + WHO",
            category: "anxiety",
            language: "hi",
            type: "psychoeducation",
            severity: "medium",
            tags: ["anxiety", "hindi", "चिंता", "घबराहट", "breathing", "grounding", "5-4-3-2-1"]
        }
    },

    {
        content: `अवसाद (डिप्रेशन) को समझना — हिंदी (DEPRESSION IN HINDI)

डिप्रेशन क्या है?
डिप्रेशन एक बीमारी है — यह कमज़ोरी या आलस नहीं है। यह दिमाग़ की रसायन विज्ञान, सोचने के तरीके और व्यवहार को प्रभावित करती है।

डिप्रेशन के लक्षण:
- लगातार उदासी या खालीपन का एहसास
- उन चीज़ों में मज़ा न आना जो पहले अच्छी लगती थीं
- थकान और ऊर्जा की कमी
- नींद में गड़बड़ी (बहुत कम या बहुत ज़्यादा)
- भूख में बदलाव
- ध्यान लगाने में परेशानी
- बेकार होने या गलत होने की भावना
- कभी-कभी मरने के विचार आना

भारत में डिप्रेशन से जुड़ी ग़लतफ़हमियां:
❌ "बस खुश रहो, सोचना बंद करो"
❌ "यह तो बस ड्रामा है"
❌ "मंदिर/मस्जिद जाओ, ठीक हो जाओगे"
✓ सच: डिप्रेशन एक असली बीमारी है जिसका इलाज होता है।

क्या मदद करता है:
- थेरेपी — खासकर CBT (काम करने का तरीका बदलना + सोच बदलना)
- दवाइयां — डॉक्टर की सलाह पर
- रोज़ाना चलना या हल्का व्यायाम
- किसी भरोसेमंद से बात करना — अकेलापन डिप्रेशन को बढ़ाता है
- छोटी-छोटी गतिविधियां करते रहना, भले मन न हो

याद रखें: डिप्रेशन में मोटिवेशन पहले नहीं आता — पहले काम करना होता है, फिर मोटिवेशन आता है।`,
        metadata: {
            source: "NIMH Hindi + iCall India + WHO MH Gap Hindi",
            category: "depression",
            language: "hi",
            type: "psychoeducation",
            severity: "medium",
            tags: ["depression", "hindi", "अवसाद", "उदासी", "CBT", "therapy", "stigma", "India"]
        }
    },

    {
        content: `तनाव से राहत के उपाय — हिंदी (STRESS RELIEF IN HINDI)

तनाव क्या है?
तनाव तब होता है जब जीवन की मांगें हमारी क्षमता से ज़्यादा लगने लगती हैं। थोड़ा तनाव ज़रूरी है — यह हमें काम करने की ऊर्जा देता है। लेकिन लगातार तनाव शरीर और मन दोनों को नुकसान पहुंचाता है।

भारतीय जीवन में सामान्य तनाव के कारण:
- नौकरी का दबाव और अनिश्चितता
- परिवार की ज़िम्मेदारियां
- शादी और रिश्तों की परेशानियां
- पैसों की समस्याएं
- माता-पिता और बुज़ुर्गों की देखभाल
- बच्चों की परवरिश

तनाव कम करने के तरीके:

1. प्रगतिशील मांसपेशी शिथिलीकरण (PMR):
शरीर के हर हिस्से को 5 सेकंड तनाव दें, फिर ढीला छोड़ें।
पैर से शुरू करें, ऊपर की ओर जाएं।

2. जर्नलिंग (लिखना):
रोज़ 10-15 मिनट बिना रोके अपनी भावनाएं लिखें।
यह मन का बोझ हल्का करता है।

3. सामाजिक संपर्क:
किसी भरोसेमंद दोस्त या परिवार के सदस्य से बात करें।
अकेलेपन में तनाव बढ़ता है।

4. सीमाएं तय करें:
"ना" कहना सीखें — यह स्वार्थ नहीं, आत्म-देखभाल है।
काम के बाद "शटडाउन रूटीन" बनाएं।

5. व्यायाम:
रोज़ 30 मिनट — चलना, योग, कुछ भी।
यह तनाव हार्मोन (cortisol) को सीधे कम करता है।`,
        metadata: {
            source: "WHO Stress + iCall India + NIMHANS",
            category: "stress",
            language: "hi",
            type: "technique",
            severity: "low",
            tags: ["stress", "hindi", "तनाव", "PMR", "journaling", "exercise", "boundaries", "India"]
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // SECTION 10: MARATHI — ANXIETY, DEPRESSION, GENERAL
    // ─────────────────────────────────────────────────────────────────

    {
        content: `चिंता समजून घेणे — मराठी (ANXIETY IN MARATHI)

चिंता म्हणजे काय?
चिंता ही आपल्या शरीराची नैसर्गिक अलार्म यंत्रणा आहे. मेंदूला धोका जाणवला — खरा असो किंवा काल्पनिक — की तो "लढा किंवा पळा" प्रतिक्रिया सुरू करतो.

चिंतेची लक्षणे:
- हृदय जोरात धडधडणे
- श्वास घेण्यास त्रास होणे
- घाम येणे
- थरथर कापणे
- पोटात गडबड
- झोप न येणे
- सतत वाईट विचार येणे

चिंता समस्या कधी बनते?
- जेव्हा ती कारणाशिवाय येते
- जेव्हा ती रोजच्या जीवनात, कामात किंवा नातेसंबंधांत अडथळा आणते

चिंता कमी करण्याचे उपाय:

1. बॉक्स श्वासोच्छवास:
4 सेकंद श्वास घ्या → 4 सेकंद थांबा → 4 सेकंद सोडा → 4 सेकंद थांबा
4-6 वेळा करा.

2. 5-4-3-2-1 ग्राउंडिंग:
5 गोष्टी दिसतात त्या सांगा
4 गोष्टी स्पर्श करा आणि त्यांचा पोत जाणा
3 गोष्टी ऐकू येतात त्या सांगा
2 गोष्टी वास येतात त्या सांगा
1 गोष्ट चव घ्या

3. व्यायाम — रोज 30 मिनिटे चालणे देखील चिंता खूप कमी करते.

4. विचारांना आव्हान द्या:
"या भीतीसाठी काही पुरावा आहे का?"
"सर्वात वाईट काय होईल आणि मी ते सहन करू शकतो/शकते का?"

लक्षात ठेवा: चिंता हा आजार आहे, कमकुवतपणा नाही. यावर उपचार होतो.`,
        metadata: {
            source: "iCall India Marathi + NIMHANS + WHO",
            category: "anxiety",
            language: "mr",
            type: "psychoeducation",
            severity: "medium",
            tags: ["anxiety", "marathi", "चिंता", "breathing", "grounding", "5-4-3-2-1", "मराठी"]
        }
    },

    {
        content: `नैराश्य (डिप्रेशन) समजून घेणे — मराठी (DEPRESSION IN MARATHI)

नैराश्य म्हणजे काय?
नैराश्य हा एक आजार आहे — आळस किंवा कमकुवतपणा नाही. हा मेंदूच्या रसायनशास्त्रावर, विचार करण्याच्या पद्धतीवर आणि वर्तनावर परिणाम करतो.

नैराश्याची लक्षणे:
- सतत दुःख किंवा रिकामेपणाची भावना
- आधी आवडणाऱ्या गोष्टींमध्ये आनंद न येणे
- थकवा आणि ऊर्जेचा अभाव
- झोपेत बदल (खूप कमी किंवा खूप जास्त)
- भूक मध्ये बदल
- लक्ष केंद्रित करण्यात अडचण
- स्वतःला निरुपयोगी वाटणे
- कधीकधी मृत्यूचे विचार येणे

महाराष्ट्रातील सामान्य गैरसमज:
❌ "फक्त खूश राहा, विचार करणे बंद करा"
❌ "हे नाटक आहे"
❌ "देवळात जा, बरे होशील"
✓ खरे: नैराश्य हा खरा आजार आहे ज्यावर उपचार होतो.

काय मदत करते:
- थेरपी — विशेषतः CBT
- औषधे — डॉक्टरांच्या सल्ल्याने
- रोज चालणे किंवा हलका व्यायाम
- एखाद्या विश्वासू व्यक्तीशी बोलणे
- छोट्या छोट्या गोष्टी करत राहणे, मन नसले तरी

लक्षात ठेवा: नैराश्यात प्रेरणा आधी येत नाही — आधी कृती करावी लागते, मग प्रेरणा येते.`,
        metadata: {
            source: "iCall India Marathi + NIMHANS + WHO MH Gap",
            category: "depression",
            language: "mr",
            type: "psychoeducation",
            severity: "medium",
            tags: ["depression", "marathi", "नैराश्य", "CBT", "therapy", "stigma", "India", "मराठी"]
        }
    },

    {
        content: `ताण कमी करण्याचे उपाय — मराठी (STRESS RELIEF IN MARATHI)

ताण म्हणजे काय?
जेव्हा जीवनाच्या मागण्या आपल्या क्षमतेपेक्षा जास्त वाटतात तेव्हा ताण येतो. थोडा ताण आवश्यक असतो — पण सतत ताण शरीर आणि मन दोन्हींना नुकसान करतो.

महाराष्ट्रातील सामान्य ताणाची कारणे:
- नोकरीचा दबाव आणि अनिश्चितता
- कुटुंबाच्या जबाबदाऱ्या
- लग्न आणि नातेसंबंधांचे प्रश्न
- आर्थिक समस्या
- शेतकरी संकट (महाराष्ट्रातील विशेष समस्या)
- मुलांचे संगोपन

ताण कमी करण्याचे उपाय:

1. श्वासोच्छवास व्यायाम:
हळूहळू श्वास घ्या — पोट फुगवा, 4 सेकंद थांबा, हळू सोडा.

2. लिखाण (Journaling):
रोज 10-15 मिनिटे आपल्या भावना लिहा.
मनाचा भार हलका होतो.

3. सामाजिक संपर्क:
विश्वासू मित्र किंवा कुटुंबाशी बोला.
एकटेपणात ताण वाढतो.

4. मर्यादा ठरवा:
"नाही" म्हणणे शिका — हे स्वार्थीपणा नाही, स्वतःची काळजी आहे.

5. व्यायाम:
रोज 30 मिनिटे — चालणे, योग, काहीही.
हे तणाव संप्रेरक (cortisol) थेट कमी करते.

शेतकरी आणि आर्थिक संकटात असलेल्यांसाठी:
iCall: 9152987821 — मोफत, मराठीत उपलब्ध`,
        metadata: {
            source: "iCall India Marathi + NIMHANS + WHO + Maharashtra Farmer Crisis Resources",
            category: "stress",
            language: "mr",
            type: "technique",
            severity: "low",
            tags: ["stress", "marathi", "ताण", "journaling", "exercise", "boundaries", "farmer", "Maharashtra", "मराठी"]
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // SECTION 11: INDIA-SPECIFIC CULTURAL CONTEXT
    // ─────────────────────────────────────────────────────────────────

    {
        content: `MENTAL HEALTH IN THE INDIAN CONTEXT — Cultural Considerations

Understanding stigma in India:
Mental health stigma remains high in India. Many people fear that:
- Seeking help means they are "pagal" (crazy)
- Family reputation will be damaged
- They will be judged by community, neighbors, or potential marriage partners
- Medication means permanent dependence or "going mad"

How to address stigma sensitively:
- Normalize mental health by comparing to physical health: "Just as you'd see a doctor for diabetes, a therapist helps with emotional health"
- Use neutral language: "mental wellness", "emotional health", "stress counseling" rather than "psychiatric treatment"
- Emphasize confidentiality
- Acknowledge family pressure is real and valid

Common Indian presenting issues:
1. Academic pressure — class 10/12 boards, JEE, NEET, competitive exams
2. Marriage pressure — age-related pressure, arranged marriage difficulties
3. Family obligation vs personal needs — especially for women and younger adults
4. Financial stress and job insecurity
5. Farmer distress (Maharashtra, Punjab, Andhra Pradesh)
6. LGBTQ+ identity in family/social context
7. Migration stress — rural to urban, international
8. Caregiver burnout (joint family systems)

Protective factors in Indian culture:
- Strong family bonds (when supportive)
- Spiritual/religious practices (yoga, prayer, meditation — already normalized)
- Community support systems
- Collectivist values — people are often motivated by family wellbeing

Note: Avoid imposing Western individualistic frameworks. In India, decisions are often made collectively, and this is valid. Work within the cultural context.`,
        metadata: {
            source: "iCall India + NIMHANS Cultural Competency + Vandrevala Foundation",
            category: "cultural",
            language: "en",
            type: "cultural",
            severity: "low",
            tags: ["India", "stigma", "culture", "family", "marriage", "academic-pressure", "farmer", "LGBTQ", "collectivist", "cultural-competency"]
        }
    },

    {
        content: `ACADEMIC PRESSURE AND EXAM STRESS — Indian Student Context

India-specific context:
Millions of Indian students face extreme pressure around board exams, JEE, NEET, UPSC, and other competitive examinations. This pressure comes from family expectations, peer competition, coaching culture, and limited alternative pathways culturally.

Warning signs of exam-related mental health crisis:
- Refusing to eat or sleep for extended periods
- Complete withdrawal from family
- Saying "if I don't clear this, there's no point"
- Giving away belongings before results
- Expressing hopelessness about the future

WHAT TO SAY TO A STRESSED STUDENT:
"Your worth is not your rank. You are more than your exam result."
"One exam does not determine your whole life."
"Many people who did not crack JEE/NEET are living meaningful, successful lives."
"Right now, your mental health is more important than any result."

COPING STRATEGIES FOR EXAM STRESS:
1. Pomodoro technique: 25 min study → 5 min break → repeat
2. Physical movement between study sessions
3. Sleep is not wasted time — memory consolidates during sleep
4. Social connection — isolation during exams worsens anxiety
5. Realistic goal setting — compare yourself to your yesterday, not toppers

FOR PARENTS:
- Avoid conditional love ("I'll be proud of you only if you crack it")
- Validate effort, not just outcomes
- Watch for warning signs — take them seriously
- Your reaction to results matters enormously

Crisis contact for students:
- iCall: 9152987821
- Vandrevala Foundation: 1860-2662-345 (24/7)`,
        metadata: {
            source: "iCall India Student Resources + NIMHANS Youth Mental Health",
            category: "cultural",
            language: "en",
            type: "cultural",
            severity: "high",
            tags: ["India", "students", "exam-stress", "JEE", "NEET", "academic-pressure", "parents", "boards", "UPSC", "youth"]
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // SECTION 12: GENERAL CONVERSATIONAL RESPONSES
    // ─────────────────────────────────────────────────────────────────

    {
        content: `HOW TO RESPOND TO COMMON EMOTIONAL EXPRESSIONS

"I am feeling very sad today"
→ Acknowledge first, don't rush to fix: "I hear you. It sounds like today is really heavy. Do you want to tell me more about what's going on?"
→ Explore: "How long have you been feeling this way? Is there something specific that happened, or is it more of a general feeling?"
→ Validate: "Sadness is a natural human emotion. It doesn't mean something is wrong with you."

"I don't know what's wrong with me"
→ Normalize: "That feeling of not knowing why you feel the way you do is actually very common. You don't need to have a clear reason to feel bad."
→ Explore gently: "Can you describe what you're noticing — in your body, your thoughts, your daily life?"

"Nobody understands me"
→ Validate: "That feeling of being alone in your experience can be incredibly painful."
→ Explore: "Is there someone in your life you wish understood you better? What would understanding look like?"
→ Normalize: "Many people feel this way, especially when going through difficult times."

"I'm fine" (when they're clearly not)
→ Gentle invitation: "I'm glad to hear that. And if things ever feel less fine, I'm here to talk — no pressure."

"I don't want to talk about it"
→ Respect: "That's completely okay. We can talk about whatever you'd like, or just sit with this for a while."

"I feel like a burden to everyone"
→ This may indicate depression or suicidal ideation — take seriously
→ "That thought — that you're a burden — is a painful one to carry. Can you tell me more about what's making you feel that way?"
→ Check for safety gently: "When those thoughts come, do they ever include thoughts of not wanting to be here?"`,
        metadata: {
            source: "Rogerian Person-Centered Therapy + Motivational Interviewing + iCall",
            category: "communication",
            language: "en",
            type: "technique",
            severity: "low",
            tags: ["empathy", "active-listening", "response", "conversation", "validation", "emotional-support", "burden", "fine"]
        }
    },

    {
        content: `सामान्य भावनात्मक प्रतिक्रिया — हिंदी (EMOTIONAL RESPONSES IN HINDI)

"मुझे बहुत उदासी हो रही है"
→ "मैं समझ सकता/सकती हूं। आज का दिन बहुत भारी लग रहा है। क्या आप मुझे और बताना चाहेंगे?"
→ "कितने समय से ऐसा महसूस हो रहा है? कुछ खास हुआ या बस एक सामान्य एहसास है?"

"मुझे नहीं पता मुझे क्या हो रहा है"
→ "यह एहसास कि समझ नहीं आ रहा — यह बहुत आम है। आपको वजह पता होना ज़रूरी नहीं।"
→ "आप अपने शरीर में, अपने विचारों में क्या नोटिस कर रहे हैं?"

"कोई मुझे नहीं समझता"
→ "यह एहसास कि कोई नहीं समझता — यह बहुत दर्दनाक होता है।"
→ "कोई है जो समझे — वो कैसा लगेगा?"

"मैं सबके लिए बोझ हूं"
→ यह विचार गंभीर हो सकता है। ध्यान से पूछें:
→ "यह सोचकर बहुत दर्द होता होगा। क्या आप मुझे बता सकते हैं कि यह एहसास कहां से आ रहा है?"
→ "जब ऐसे विचार आते हैं, तो क्या कभी ऐसा भी लगता है कि आप यहां नहीं रहना चाहते?"

"मैं ठीक हूं" (जब नहीं लगता)
→ "अच्छा है। और अगर कभी ठीक न हो, तो मैं यहां हूं — बिना किसी दबाव के।"`,
        metadata: {
            source: "Rogerian Therapy + iCall India Hindi Resources",
            category: "communication",
            language: "hi",
            type: "technique",
            severity: "low",
            tags: ["empathy", "hindi", "response", "conversation", "validation", "भावनाएं", "बोझ"]
        }
    },

    {
        content: `सामान्य भावनिक प्रतिसाद — मराठी (EMOTIONAL RESPONSES IN MARATHI)

"मला खूप दुःख होत आहे"
→ "मला समजते. आजचा दिवस खूप जड वाटतोय. तुम्हाला अधिक सांगायचे आहे का?"
→ "किती दिवसांपासून असे वाटतेय? काही विशेष घडले का, की हे एक सामान्य भावना आहे?"

"मला माहित नाही मला काय होतेय"
→ "हे माहित नसणे — हे खूप सामान्य आहे. तुम्हाला कारण माहित असणे आवश्यक नाही."
→ "तुमच्या शरीरात, विचारांमध्ये तुम्ही काय जाणवत आहात ते सांगू शकता का?"

"कोणालाच माझे समजत नाही"
→ "कोणाला समजत नाही असे वाटणे — हे खूप वेदनादायक असते."
→ "कोण असेल जो समजेल — ते कसे दिसेल?"

"मी सगळ्यांवर ओझे आहे"
→ हे गंभीर असू शकते. काळजीपूर्वक विचारा:
→ "हा विचार मनात येणे खूप कठीण असेल. कुठून हे वाटतेय ते सांगता का?"
→ "असे विचार येतात तेव्हा, कधी असेही वाटते का की तुम्हाला इथे राहायचे नाही?"

"मी ठीक आहे" (जेव्हा नाही वाटत)
→ "बरे वाटले. आणि जेव्हा ठीक नसेल, तेव्हा मी इथेच आहे — कोणताही दबाव नाही."`,
        metadata: {
            source: "Rogerian Therapy + iCall India Marathi Resources",
            category: "communication",
            language: "mr",
            type: "technique",
            severity: "low",
            tags: ["empathy", "marathi", "response", "conversation", "validation", "भावना", "ओझे", "मराठी"]
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // SECTION 13: SELF-CARE AND WELLNESS
    // ─────────────────────────────────────────────────────────────────

    {
        content: `SELF-CARE — Beyond Bubble Baths (Evidence-Based)

Self-care is not a luxury — it is maintenance of the human system that allows you to function and give to others. It is not selfish; depleted people cannot sustain meaningful relationships or work.

THE FOUR PILLARS OF MENTAL WELLNESS:

1. SLEEP (Foundation — affects everything else)
7–9 hours for adults. Consistent wake time is the single most powerful intervention.
Sleep deprivation impairs emotional regulation, decision-making, and immune function.

2. MOVEMENT
150 minutes of moderate exercise per week (WHO recommendation).
Even 20–30 minutes walking has measurable mental health benefits.
Exercise increases BDNF (brain-derived neurotrophic factor) — grows new brain cells.

3. SOCIAL CONNECTION
Loneliness is as harmful to health as smoking 15 cigarettes per day (Holt-Lunstad research).
Regular meaningful connection — not just presence — is essential.
Quality over quantity: 1-2 deep relationships matter more than many shallow ones.

4. MEANING AND PURPOSE
Having reasons to get up in the morning buffers against depression and anxiety.
Can come from: work, relationships, creativity, spirituality, service to others, nature.

BASIC SELF-CARE CHECKLIST (daily):
☐ Did I sleep enough?
☐ Did I eat regular meals?
☐ Did I drink enough water?
☐ Did I move my body?
☐ Did I have any meaningful connection?
☐ Did I have any moment of calm or pleasure?

When in crisis, focus on the basics. Shower, eat, sleep. Then everything else.`,
        metadata: {
            source: "WHO Wellness + Holt-Lunstad Social Connection Research + APA",
            category: "self-care",
            language: "en",
            type: "psychoeducation",
            severity: "low",
            tags: ["self-care", "wellness", "sleep", "exercise", "social-connection", "meaning", "BDNF", "loneliness"]
        }
    },

    {
        content: `आत्म-देखभाल — हिंदी (SELF-CARE IN HINDI)

आत्म-देखभाल स्वार्थ नहीं है। यह वैसा ही है जैसे हवाई जहाज़ में पहले खुद ऑक्सीजन मास्क लगाओ, फिर दूसरों की मदद करो। आप जितना अपना ख्याल रखेंगे, उतना ही दूसरों के लिए भी कर पाएंगे।

मानसिक स्वास्थ्य के चार स्तंभ:

1. नींद — सबसे ज़रूरी
रोज़ 7-9 घंटे। एक ही समय पर उठना — सबसे ज़रूरी नियम।

2. व्यायाम
हफ्ते में कम से कम 150 मिनट हल्का व्यायाम।
रोज़ 30 मिनट चलना भी काफी असरदार है।

3. सामाजिक संपर्क
अकेलापन मानसिक स्वास्थ्य के लिए हानिकारक है।
एक-दो भरोसेमंद रिश्ते — यही काफी है।

4. उद्देश्य और अर्थ
ज़िंदगी में कुछ ऐसा होना जो आपको सुबह उठने की वजह दे।
काम, परिवार, रचनात्मकता, सेवा — कुछ भी।

रोज़ की आत्म-देखभाल सूची:
☐ क्या मैंने पर्याप्त नींद ली?
☐ क्या मैंने खाना खाया?
☐ क्या मैंने पानी पिया?
☐ क्या मैं थोड़ा हिला/हिली?
☐ क्या मैंने किसी से बात की?
☐ क्या कोई एक पल शांति या खुशी का था?

संकट में: पहले बुनियादी चीज़ें — नहाओ, खाओ, सोओ। बाकी सब बाद में।`,
        metadata: {
            source: "WHO Wellness Hindi + iCall India",
            category: "self-care",
            language: "hi",
            type: "technique",
            severity: "low",
            tags: ["self-care", "hindi", "wellness", "sleep", "exercise", "आत्म-देखभाल", "स्वास्थ्य"]
        }
    },

    {
        content: `स्वतःची काळजी — मराठी (SELF-CARE IN MARATHI)

स्वतःची काळजी घेणे स्वार्थीपणा नाही. विमानात आधी स्वतःला ऑक्सिजन मास्क लावतो, मग इतरांना — तसेच हे आहे. तुम्ही जितके स्वतःची काळजी घ्याल, तितके इतरांसाठी अधिक करू शकाल.

मानसिक आरोग्याचे चार आधारस्तंभ:

1. झोप — सर्वात महत्वाचे
रोज 7-9 तास. एकाच वेळी उठणे — सर्वात महत्वाचा नियम.

2. व्यायाम
आठवड्यात किमान 150 मिनिटे हलका व्यायाम.
रोज 30 मिनिटे चालणे देखील खूप उपयुक्त आहे.

3. सामाजिक संपर्क
एकटेपणा मानसिक आरोग्यासाठी हानिकारक आहे.
एक-दोन विश्वासू नातेसंबंध — हे पुरेसे आहे.

4. उद्देश आणि अर्थ
आयुष्यात काहीतरी असणे जे तुम्हाला सकाळी उठवते.
काम, कुटुंब, सर्जनशीलता, सेवा — काहीही.

रोजची स्वतःची काळजी यादी:
☐ मी पुरेशी झोप घेतली का?
☐ मी जेवण केले का?
☐ मी पाणी प्यायलो/प्यायले का?
☐ मी थोडे हलले का?
☐ मी कोणाशी बोललो/बोलले का?
☐ एखादा शांत किंवा आनंदाचा क्षण होता का?

संकटात: आधी मूलभूत गोष्टी — आंघोळ करा, जेवा, झोपा. बाकी नंतर.`,
        metadata: {
            source: "WHO Wellness Marathi + iCall India",
            category: "self-care",
            language: "mr",
            type: "technique",
            severity: "low",
            tags: ["self-care", "marathi", "wellness", "sleep", "exercise", "स्वतःची-काळजी", "आरोग्य", "मराठी"]
        }
    },
];

export default THERAPY_KNOWLEDGE_BASE;