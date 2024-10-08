// QuizModePage.tsx

import React, { useState, useEffect } from 'react';
import {
  Box, Flex, Button, IconButton, Text, Input,
  useDisclosure, useColorMode, useColorModeValue, Divider, Tooltip, useToast, Switch, Select,
  Drawer, DrawerBody, DrawerFooter, DrawerHeader, DrawerOverlay, DrawerContent, DrawerCloseButton,
  Stack,
} from '@chakra-ui/react';
import {
  ArrowLeftIcon, ArrowRightIcon, MoonIcon, SunIcon,
} from '@chakra-ui/icons';
import {
  ExitIcon, UpdateIcon, StarIcon, MagnifyingGlassIcon, StarFilledIcon, EyeOpenIcon, EyeNoneIcon, ShuffleIcon, HamburgerMenuIcon,
} from '@radix-ui/react-icons';
import QuestionDisplay from '../../components/QuestionDisplay';
import AdditionalInfo from '../../components/AdditionalInfo';
import SearchModal from '../../components/SearchModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import SummaryModal from '../../components/SummaryModal';
import UnansweredQuestionsModal from '../../components/UnansweredQuestionsModal';
import ResetModal from '../../components/ResetModal';
import FlipCard from '../../components/FlipCard';
import { Question } from '../../utils/types';
import LoadingLayout from '../../components/LoadingLayout';
import { useRouter } from 'next/router';
import { getBackendUrl } from '@/utils/getBackendUrl';
import { useBreakpointValue } from '@chakra-ui/react';

interface QuestionData {
  id: number;
  order: number;
  text: string;
  options: string[];
  answer: string;
  url: string;
  explanation: string;
  discussion_link: string;
  userSelectedOption: string | null;
  hasMathContent: boolean;
}

// Type for navigateToQuestion function
type NavigateToQuestionFunction = (index: number) => void;

const QuizModePage = () => {
  const backendUrl = getBackendUrl();
  const router = useRouter();
  const { id } = router.query;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isUnansweredQuestionsModalOpen, setIsUnansweredQuestionsModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [unansweredQuestions, setUnansweredQuestions] = useState<Question[]>([]);
  const [score, setScore] = useState<number>(0);
  const [showFlipCard, setShowFlipCard] = useState(true);
  const [eyeIcon, setEyeIcon] = useState('open');
  const toast = useToast();
  const [shuffle, setShuffle] = useState(false);
  const [optionsShuffled, setOptionsShuffled] = useState(false);
  const [preserveShuffleState, setPreserveShuffleState] = useState({
    questionsShuffled: false,
    optionsShuffled: false
  });

  // Adjusted shuffleArray function to be generic, enabling it to shuffle any type of array.
  const shuffleArray = <T,>(array: T[]): void => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  };

  // Utility function to shuffle the options and update the answer.
  const shuffleOptionsAndUpdateAnswer = (questions: Question[]): Question[] => {
    console.log("Shuffling options for each question");
    return questions.map((question: Question) => {
      console.log('Original question:', question);

      // Create a copy of the options to shuffle
      const options = question.options.slice();
      const correctAnswerContent = question.options.find(
        (opt, idx) => `Option ${String.fromCharCode(65 + idx)}` === question.answer
      );

      shuffleArray(options);

      const newCorrectAnswerIndex = options.findIndex(opt => opt === correctAnswerContent);
      const newAnswerLabel = `Option ${String.fromCharCode(65 + newCorrectAnswerIndex)}`;

      const updatedQuestion: Question = {
        ...question,
        options,
        answer: newAnswerLabel,
      };

      console.log('Updated question:', updatedQuestion);

      return updatedQuestion;
    });
  };

  // Modify the useEffect hook that fetches and sets questions to reapply option shuffling if optionsShuffled is true
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch(`${backendUrl}/getQuestionsByQuizSet/${id}`);
        if (!response.ok) throw new Error('Network response was not ok');
        let data = await response.json();

        console.log('Fetched data:', data);

        // Map data to Question[]
        let mappedQuestions: Question[] = data.map((q: QuestionData) => ({
          id: q.id,
          order: q.order,
          question: q.text,
          options: q.options.slice(), // Make a copy of the options array
          originalOptions: q.options.slice(), // Initialize originalOptions with a copy
          answer: q.answer,
          url: q.url,
          explanation: q.explanation,
          discussion_link: q.discussion_link,
          hasMathContent: q.hasMathContent,
          userSelectedOption: null,
        }));

        // Sort questions by 'order' field
        mappedQuestions.sort((a: Question, b: Question) => a.order - b.order);

        // Reapply option shuffle if optionsShuffled is true
        if (optionsShuffled) {
          mappedQuestions = shuffleOptionsAndUpdateAnswer(mappedQuestions);
        }

        setQuestions(mappedQuestions);

        console.log('Questions after mapping:', mappedQuestions);
      } catch (error) {
        console.error('Error fetching questions:', error);
      }
    };

    if (id) {
      fetchQuestions();
    }
  }, [id, optionsShuffled]);

  // Adjusted to better manage state updates and debugging
  const handleToggleShuffleOptions = () => {
    console.log("Toggling shuffle options from", optionsShuffled);
  
    // Immediately set the optionsShuffled state to its new value
    const newOptionsShuffledState = !optionsShuffled;
    setOptionsShuffled(newOptionsShuffledState);
  
    // Debug log to confirm state change
    console.log("Options shuffled state changed to", newOptionsShuffledState);
  
    // Update questions with shuffled or unshuffled options
    setQuestions((currentQuestions) => {
      // Create a deep copy of the current questions
      const questionsCopy = JSON.parse(JSON.stringify(currentQuestions));
  
      if (newOptionsShuffledState) {
        // Shuffle options
        const newQuestions = shuffleOptionsAndUpdateAnswer(questionsCopy);
        console.log("Questions after shuffling options", newQuestions);
        return newQuestions;
      } else {
        // Restore original options order
        const newQuestions = questionsCopy.map((question: Question) => {
          return {
            ...question,
            options: question.originalOptions?.slice() || question.options.slice(), // Use a copy of originalOptions if it exists, else fallback to options
          };
        });
        console.log("Questions after restoring original options", newQuestions);
        return newQuestions;
      }
    });
  
    // Update the preserveShuffleState to reflect the new optionsShuffled state
    setPreserveShuffleState((prevState) => ({
      ...prevState,
      optionsShuffled: newOptionsShuffledState,
    }));
  };  

  const confirmShuffleQuestions = async () => {
    console.log("Confirming shuffle questions...");
    try {
      console.log("Before fetching shuffled questions");
      const shuffledResponse = await fetch(`${backendUrl}/shuffleQuestions/${id}`, { method: 'POST' });
      if (!shuffledResponse.ok) throw new Error('Error shuffling questions');
  
      let shuffledQuestionsData = await shuffledResponse.json();
      console.log("Shuffled questions received:", shuffledQuestionsData);
  
      // Map to Question[]
      let shuffledQuestions: Question[] = shuffledQuestionsData.map((q: QuestionData) => ({
        id: q.id,
        order: q.order,
        question: q.text,
        options: q.options,
        answer: q.answer,
        url: q.url,
        explanation: q.explanation,
        discussion_link: q.discussion_link,
        hasMathContent: q.hasMathContent,
        userSelectedOption: null,
      }));
  
      // Reapply options shuffle if optionsShuffled is true
      if (optionsShuffled) {
        console.log("Reapplying options shuffle after questions shuffle");
        shuffledQuestions = shuffleOptionsAndUpdateAnswer(shuffledQuestions);
      }
  
      console.log("Setting preserve shuffle state");
      setPreserveShuffleState({
        questionsShuffled: true,
        optionsShuffled,
      });
  
      // Update the questions state with shuffled questions
      setQuestions(shuffledQuestions);
      console.log("Questions state updated after shuffle");
  
      console.log("Resetting current question index to 0");
      setCurrentQuestionIndex(0);
      onConfirmationModalClose();
  
      toast({
        title: "Questions Shuffled",
        description: "Questions have been shuffled.",
        status: "info",
        duration: 3000,
        isClosable: true,
        position: "bottom-right",
      });
    } catch (error) {
      console.error('Error shuffling questions:', error);
    }
  };  

  const handleFlipCard = () => {
    setIsCardFlipped(prev => !prev);
  };

  const fetchUserSelections = async () => {
    try {
      const response = await fetch(`${backendUrl}/getUserSelections/${id}`);
      if (!response.ok) throw new Error('Network response was not ok');
      const selections = await response.json();
      setQuestions(prevQuestions => prevQuestions.map(q => ({
        ...q,
        userSelectedOption: selections[q.id] || null
      })));
    } catch (error) {
      console.error('Error fetching user selections:', error);
    }
  };

  const fetchQuestionsAndUpdateSelections = async () => {
    console.log("Fetching questions...");
    try {
      const response = await fetch(`${backendUrl}/getQuestionsByQuizSet/${id}`);
      if (!response.ok) throw new Error('Network response was not ok');
      let data = await response.json();
  
      console.log("Fetched Questions Data:", data);
  
      // Map data to Question[]
      let mappedQuestions: Question[] = data.map((q: QuestionData) => ({
        id: q.id,
        order: q.order,
        question: q.text,
        options: q.options.slice(), // Make a copy of the options array
        originalOptions: q.options.slice(), // Initialize originalOptions with a copy
        answer: q.answer,
        url: q.url,
        explanation: q.explanation,
        discussion_link: q.discussion_link,
        hasMathContent: q.hasMathContent,
        userSelectedOption: null,
      }));
  
      // Sort questions by 'order' field
      mappedQuestions.sort((a: Question, b: Question) => a.order - b.order);
  
      setQuestions(mappedQuestions);
      await fetchUserSelections();
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  };    

  const fetchEyeIconState = async () => {
    const response = await fetch(`${backendUrl}/getEyeIconState/${id}`);  // Use quiz set ID
    const data = await response.json();
    if (response.ok) {
      setEyeIcon(data.state ? 'open' : 'none');
      setShowFlipCard(data.state);
      setIsCardFlipped(!data.state);
    }
  };

  useEffect(() => {
    if (id) {
      fetchQuestionsAndUpdateSelections();
      fetchFavorites();
    }
  }, [id]);
  
  useEffect(() => {
    fetchEyeIconState();
  }, [currentQuestionIndex, questions]);

  useEffect(() => {
    const answeredQuestions = questions.filter(q => q.userSelectedOption !== null);
    const unansweredQuestions = questions.filter(q => q.userSelectedOption === null);
    switch (selectedFilter) {
      case 'favorites':
        setFilteredQuestions(questions.filter(question => favorites.has(question.id)));
        break;
      case 'answered':
        setFilteredQuestions(answeredQuestions);
        break;
      case 'unanswered':
        setFilteredQuestions(unansweredQuestions);
        break;
      default:
        setFilteredQuestions(questions);
    }
  }, [questions, favorites, selectedFilter]);

  const fetchFavorites = async () => {
    try {
      const response = await fetch(`${backendUrl}/getFavorites/${id}`);
      if (!response.ok) throw new Error('Network response was not ok');
      const favoritedQuestions = await response.json();
      setFavorites(new Set(favoritedQuestions.map((q: { id: number }) => q.id)));
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  const handleNavigate = (action: string, value?: number) => {
    setIsCardFlipped(false);

    let newIndex = currentQuestionIndex;
    switch (action) {
      case 'prev':
        newIndex = Math.max(currentQuestionIndex - 1, 0);
        break;
      case 'next':
        newIndex = Math.min(currentQuestionIndex + 1, filteredQuestions.length - 1);
        break;
      case 'goto':
        newIndex = value ? value - 1 : currentQuestionIndex;
        break;
      case 'reset':
        setCurrentQuestionIndex(0);
        return;
    }
    if (newIndex >= 0 && newIndex < filteredQuestions.length) {
      setCurrentQuestionIndex(newIndex);
    }
  };

  const handleToggleFavorites = (questionId: number) => {
    fetch(`${backendUrl}/toggleFavorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId })
    })
    .then(response => response.json())
    .then(() => {
      setFavorites(prev => {
        const newFavorites = new Set(prev);
        let message = "";
        if (newFavorites.has(questionId)) {
          newFavorites.delete(questionId);
          message = "Removed from Favorites";
        } else {
          newFavorites.add(questionId);
          message = "Added to Favorites";
        }
        toast({
          title: message,
          status: "info",
          duration: 3000,
          isClosable: true,
          position: "bottom-right"
        });
        return newFavorites;
      });
    })
    .then(() => {
      if (selectedFilter === 'favorites') {
        setFilteredQuestions(questions.filter(question => favorites.has(question.id)));
      }
    })
    .catch(error => console.error('Error toggling favorite:', error));
  };  

  const handleDropdownChange = (value: string) => {
    setSelectedFilter(value);
    setCurrentQuestionIndex(0);
  };

  const handleOptionSelect = async (optionIndex: number | null) => {
    const questionId = filteredQuestions[currentQuestionIndex].id;
    const currentQuestion = questions.find(q => q.id === questionId);
  
    if (!currentQuestion) {
      console.error("Question not found");
      return;
    }
  
    const previouslySelectedOptionIndex = currentQuestion.options.findIndex(opt => opt === currentQuestion.userSelectedOption);
    
    let selectedOption: string | null = null;
    if (optionIndex !== null) {
      selectedOption = `Option ${String.fromCharCode(65 + optionIndex)}`;
    }
    
    const isCorrect = selectedOption === currentQuestion.answer;
    
    // Update score logic...
    if (selectedOption && previouslySelectedOptionIndex !== optionIndex) {
      const increment = isCorrect ? 1 : 0;
      await updateScore(questionId, increment);
    } else if (!selectedOption && previouslySelectedOptionIndex !== null) {
      const decrement = currentQuestion.options[previouslySelectedOptionIndex] === currentQuestion.answer ? -1 : 0;
      await updateScore(questionId, decrement);
    }
  
    await fetch(`${backendUrl}/updateUserSelection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId, selected_option: selectedOption })
    });
  
    setQuestions(prevQuestions => prevQuestions.map(q => {
      if (q.id === questionId) {
        return { ...q, userSelectedOption: selectedOption };
      }
      return q;
    }));
  };  

const updateScore = async (questionId: number, scoreChange: number) => {
  await fetch(`${backendUrl}/updateScore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId, increment: scoreChange, quiz_set_id: id })
  });
  // Fetch the updated score here if needed
};

  const { isOpen: isSearchModalOpen, onOpen: onSearchModalOpen, onClose: onSearchModalClose } = useDisclosure();
  const { isOpen: isConfirmationModalOpen, onOpen: onConfirmationModalOpen, onClose: onConfirmationModalClose } = useDisclosure();
  const { isOpen: isResetModalOpen, onOpen: onResetModalOpen, onClose: onResetModalClose } = useDisclosure();

  const { colorMode, toggleColorMode } = useColorMode();
  const iconBg = useColorModeValue('white', 'transparent');
  const iconHoverBg = useColorModeValue('#edf2f8', '#2c323d');
  const cardBgColor = useColorModeValue('gray.50', 'gray.700');
  const cardTextColor = useColorModeValue('black', 'white');

  const defaultQuestion: Question = {
    id: 0,
    order: 0,  // Add this line
    question: "Question",
    options: ["A. Option A", "B. Option B", "C. Option C", "D. Option D"],
    answer: "Correct Answer",
    url: "Placeholder URL",
    explanation: "Placeholder Explanation",
    discussion_link: "Placeholder Discussion Link",
    userSelectedOption: null,
    hasMathContent: false,
  };      

  const isQuestionAvailable = currentQuestionIndex < filteredQuestions.length;
  const displayedQuestion = isQuestionAvailable ? filteredQuestions[currentQuestionIndex] : defaultQuestion;

  const safeUrl = displayedQuestion.url || "";
  const safeExplanation = displayedQuestion.explanation || "";

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchKeyword(e.target.value);
  };

  const onNavigateToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    onSearchModalClose(); // Close the search modal
  };

  const handleSubmit = () => {
    const unansweredQuestions = questions.filter(q => q.userSelectedOption === null);

    if (unansweredQuestions.length > 0) {
        setUnansweredQuestions(unansweredQuestions);
        setIsUnansweredQuestionsModalOpen(true);
    } else {
        calculateAndShowSummary();
    }
  };

  const calculateAndShowSummary = () => {
    const calculatedScore = questions.reduce((acc, question) => {
      const correct = question.userSelectedOption === question.answer;
      return acc + (correct ? 1 : 0);
    }, 0);
  
    console.log(`Calculated Score: ${calculatedScore}`);
    setScore(calculatedScore);
    updateScoreInDatabase(calculatedScore); // Update score in database
  
    const passingScore = 70; // Define your passing score threshold
    const newStatus = calculatedScore / questions.length >= passingScore / 100 ? 'Passed' : 'Failed';
    updateQuizSetStatus(newStatus); // Update the status in the backend
    setIsSummaryModalOpen(true);
  };

  const updateQuizSetStatus = async (status: string) => {
    try {
      await fetch(`${backendUrl}/updateQuizSetStatus/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } catch (error) {
      console.error('Error updating quiz set status:', error);
    }
  };
  
  const updateScoreInDatabase = (score: number) => {
    // Assuming you have an endpoint to update the score
    fetch(`${backendUrl}/updateQuizSetScore/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score })
    })
    .then(response => response.json())
    .then(data => console.log('Score updated in database:', data))
    .catch(error => console.error('Error updating score:', error));
  };  

  const onSubmitWithUnanswered = () => {
    setIsUnansweredQuestionsModalOpen(false);
    calculateAndShowSummary();
  };

  const navigateToIncorrect = (navigateToQuestion: NavigateToQuestionFunction) => {
    setSelectedFilter('incorrect');
    navigateToQuestion(0);
    setIsSummaryModalOpen(false);
  };

  useEffect(() => {
    let filtered;
    switch (selectedFilter) {
      case 'favorites':
        filtered = questions.filter(question => favorites.has(question.id));
        break;
      case 'answered':
        filtered = questions.filter(q => q.userSelectedOption !== null);
        break;
      case 'unanswered':
        filtered = questions.filter(q => q.userSelectedOption === null);
        break;
      case 'incorrect':
        filtered = questions.filter(q => q.userSelectedOption !== q.answer);
        break;
      default:
        filtered = [...questions];
    }
    // Sort the filtered questions by 'order' field
    filtered.sort((a: Question, b: Question) => a.order - b.order);
    setFilteredQuestions(filtered);
  }, [questions, favorites, selectedFilter]);  

  const getQuestionIndex = (questionId: number, filter: string) => {
    let list;
    switch (filter) {
      case 'favorites':
        list = questions.filter(q => favorites.has(q.id));
        break;
      case 'answered':
        list = questions.filter(q => q.userSelectedOption !== null);
        break;
      case 'unanswered':
        list = questions.filter(q => q.userSelectedOption === null);
        break;
      case 'incorrect':
        list = questions.filter(q => q.userSelectedOption !== q.answer);
        break;
      default:
        list = [...questions];
    }
    // Sort the list by 'order' field
    list.sort((a: Question, b: Question) => a.order - b.order);
    // Find the index in the filtered list
    return list.findIndex(q => q.id === questionId);
  };  

  const handleReset = async () => {
    console.log("Initiating reset");
    try {
      const response = await fetch(`${backendUrl}/resetQuestions/${id}`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Network response was not ok');
  
      console.log("Reset successful, refetching questions");
      await fetchQuestionsAndUpdateSelections();
  
      setCurrentQuestionIndex(0);
  
      onResetModalClose();
  
      toast({
        title: "Questions Reset",
        description: "All questions and answers have been reset.",
        status: "info",
        duration: 3000,
        isClosable: true,
        position: "bottom-right"
      });
    } catch (error) {
      console.error('Error resetting questions:', error);
    }
  };  

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if the target is the input for question navigation
      if (document.activeElement?.tagName === 'INPUT') {
        return; // Do not execute keyboard shortcuts when typing in input
      }

      switch (event.key) {
        case ' ':
          event.preventDefault(); // Prevent scrolling on space key
          handleFlipCard(); // Flip card
          break;
        case 'ArrowLeft':
          handleNavigate('prev'); // Go to previous question
          break;
        case 'ArrowRight':
          handleNavigate('next'); // Go to next question
          break;
        default:
          break; // Do nothing for other keys
      }
    };

    // Attach the event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup function to remove the event listener
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentQuestionIndex, filteredQuestions.length]); // Dependencies for useEffect

  // Function to toggle Flip Card visibility and icon state
  const toggleFlipCardVisibility = () => {
    const newState = eyeIcon === 'open' ? 'none' : 'open';
    fetch(`${backendUrl}/updateEyeIconState/${id}`, {  // Use quiz set ID
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: newState === 'open' })
    }).then(() => {
      setEyeIcon(newState);
      setShowFlipCard(newState === 'open');
      setIsCardFlipped(newState !== 'open');
    });
  };

  // Determine if we're on a mobile device
  const isMobile = useBreakpointValue({ base: true, md: false });

  const {
    isOpen: isDrawerOpen,
    onOpen: onDrawerOpen,
    onClose: onDrawerClose,
  } = useDisclosure();

  return (
    <LoadingLayout key={selectedFilter}>
      <Box p={4}>
        {/* Parent Flex Container */}
        <Flex
          justifyContent="space-between"
          align="center"
          mb={4}
          direction="row"
          position="relative" // Make the parent position relative
        >
          {/* Left Part */}
          <Flex align="center" gap={2}>
            {/* Back Button */}
            <Tooltip label="Go Back" aria-label="Go Back Tooltip">
              <IconButton
                aria-label="Go back"
                icon={<ExitIcon style={{ transform: 'scaleX(-1)', width: '20px', height: '20px' }} />}
                onClick={() => router.push('/Dashboard')}
                backgroundColor="transparent"
                _hover={{ backgroundColor: iconHoverBg }}
              />
            </Tooltip>
            {!isMobile && (
              <>
                {/* Reset Button */}
                <Tooltip label="Reset" aria-label="Reset Tooltip">
                  <IconButton
                    aria-label="Reset"
                    icon={<UpdateIcon style={{ width: '20px', height: '20px' }} />}
                    onClick={onResetModalOpen}
                    backgroundColor="transparent"
                    _hover={{ backgroundColor: iconHoverBg }}
                  />
                </Tooltip>
                {/* Hide Flip Card Button */}
                <Tooltip
                  label={eyeIcon === 'open' ? 'Hide Flip Card' : 'Show Flip Card'}
                  aria-label="Toggle Flip Card Visibility Tooltip"
                >
                  <IconButton
                    aria-label="Toggle Flip Card Visibility"
                    icon={
                      eyeIcon === 'open' ? (
                        <EyeOpenIcon style={{ width: '20px', height: '20px' }} />
                      ) : (
                        <EyeNoneIcon style={{ width: '20px', height: '20px' }} />
                      )
                    }
                    onClick={toggleFlipCardVisibility}
                    backgroundColor="transparent"
                    _hover={{ backgroundColor: iconHoverBg }}
                  />
                </Tooltip>
                {/* Submit Button */}
                <Tooltip label="Submit" aria-label="Submit Tooltip">
                  <Button
                    onClick={handleSubmit}
                    backgroundColor="transparent"
                    _hover={{ backgroundColor: iconHoverBg }}
                  >
                    Submit
                  </Button>
                </Tooltip>
                {/* Shuffle Options Switch */}
                <Switch
                  isChecked={optionsShuffled}
                  onChange={handleToggleShuffleOptions}
                  size="lg"
                  colorScheme="teal"
                />
              </>
            )}
          </Flex>

          {/* Middle Part for question navigation */}
          <Flex
            position="absolute" // Position absolutely within the parent
            left="50%" // Position from the left 50%
            transform="translateX(-50%)" // Shift left by 50% of its own width to center
            align="center"
          >
            {/* Question Navigation Input */}
            <Input
              type="number"
              value={currentQuestionIndex + 1}
              onChange={(e) => handleNavigate('goto', Number(e.target.value))}
              width="75px"
              marginRight={2}
              fontSize="15px"
              textAlign="center"
            />
            <Text marginX={2} fontSize="15px">
              / {filteredQuestions.length}
            </Text>
          </Flex>

          {/* Right Part */}
          <Flex align="center" gap={2}>
          {isMobile ? (
            <>
              <IconButton
                aria-label="Menu"
                icon={<HamburgerMenuIcon style={{ width: '20px', height: '20px' }} />}
                onClick={onDrawerOpen}
                backgroundColor="transparent"
                _hover={{ backgroundColor: iconHoverBg }}
              />
              {/* Drawer for Mobile Menu */}
              <Drawer
                isOpen={isDrawerOpen}
                placement="right"
                onClose={onDrawerClose}
              >
                <DrawerOverlay />
                <DrawerContent>
                  {/* Adjusted Header Section */}
                  <DrawerHeader p={0}>
                    <Flex align="center" justify="space-between" p={4}>
                      <Text fontSize="lg" fontWeight="bold">
                        Menu
                      </Text>
                      <DrawerCloseButton position="static" />
                    </Flex>
                  </DrawerHeader>

                  <DrawerBody>
                    <Stack spacing={4}>
                      {/* Filter Select */}
                      <Select
                        value={selectedFilter}
                        onChange={(e) =>
                          handleDropdownChange(e.target.value)
                        }
                      >
                        <option value="all">All Questions</option>
                        <option value="favorites">Favorites</option>
                        <option value="incorrect">Incorrect</option>
                        <option value="answered">Answered</option>
                        <option value="unanswered">Unanswered</option>
                      </Select>

                      {/* Add to Favorites */}
                      <Button
                        onClick={() =>
                          isQuestionAvailable &&
                          handleToggleFavorites(displayedQuestion.id)
                        }
                        leftIcon={
                          isQuestionAvailable &&
                          favorites.has(displayedQuestion.id) ? (
                            <StarFilledIcon
                              style={{ width: '20px', height: '20px' }}
                            />
                          ) : (
                            <StarIcon
                              style={{ width: '20px', height: '20px' }}
                            />
                          )
                        }
                        variant="ghost"
                        fontWeight="bold"
                      >
                        {favorites.has(displayedQuestion.id)
                          ? 'Remove from Favorites'
                          : 'Add to Favorites'}
                      </Button>

                      {/* Submit Button */}
                      <Button
                        onClick={handleSubmit}
                        variant="ghost"
                        fontWeight="bold"
                      >
                        Submit
                      </Button>

                      {/* Shuffle Choices */}
                      <Flex alignItems="center" justifyContent="center">
                        <Switch
                          isChecked={optionsShuffled}
                          onChange={handleToggleShuffleOptions}
                          size="lg"
                          colorScheme="teal"
                          mr={2}
                        />
                        <Text fontWeight="bold">Shuffle Choices</Text>
                      </Flex>

                      {/* Shuffle Questions */}
                      <Button
                        onClick={onConfirmationModalOpen}
                        leftIcon={<ShuffleIcon style={{ width: '20px', height: '20px' }} />}
                        variant="ghost"
                        fontWeight="bold"
                      >
                        Shuffle Questions
                      </Button>

                      {/* Hide Flip Card */}
                      <Button
                        onClick={toggleFlipCardVisibility}
                        leftIcon={
                          eyeIcon === 'open' ? (
                            <EyeOpenIcon
                              style={{ width: '20px', height: '20px' }}
                            />
                          ) : (
                            <EyeNoneIcon
                              style={{ width: '20px', height: '20px' }}
                            />
                          )
                        }
                        variant="ghost"
                        fontWeight="bold"
                      >
                        {eyeIcon === 'open'
                          ? 'Hide Flip Card'
                          : 'Show Flip Card'}
                      </Button>

                      {/* Reset Button */}
                      <Button
                        onClick={onResetModalOpen}
                        leftIcon={
                          <UpdateIcon
                            style={{ width: '20px', height: '20px' }}
                          />
                        }
                        variant="ghost"
                        fontWeight="bold"
                      >
                        Reset
                      </Button>

                      {/* Search Button */}
                      <Button
                        onClick={onSearchModalOpen}
                        leftIcon={
                          <MagnifyingGlassIcon
                            style={{ width: '23px', height: '23px' }}
                          />
                        }
                        variant="ghost"
                        fontWeight="bold"
                      >
                        Search
                      </Button>

                      {/* Theme Toggle Button */}
                      <Button
                        onClick={toggleColorMode}
                        leftIcon={
                          colorMode === 'dark' ? (
                            <SunIcon
                              style={{ width: '20px', height: '20px' }}
                            />
                          ) : (
                            <MoonIcon
                              style={{ width: '20px', height: '20px' }}
                            />
                          )
                        }
                        variant="ghost"
                        fontWeight="bold"
                      >
                        Toggle {colorMode === 'light' ? 'Dark' : 'Light'} Mode
                      </Button>
                    </Stack>
                  </DrawerBody>

                  {/* Removed DrawerFooter */}
                </DrawerContent>
              </Drawer>
            </>
            ) : (
              <Flex align="center" gap={2}>
                {/* Filter Select */}
                <Select
                  value={selectedFilter}
                  onChange={(e) => handleDropdownChange(e.target.value)}
                  width="180px"
                >
                  <option value="all">All Questions</option>
                  <option value="favorites">Favorites</option>
                  <option value="incorrect">Incorrect</option>
                  <option value="answered">Answered</option>
                  <option value="unanswered">Unanswered</option>
                </Select>

                {/* Favorites Button */}
                <Tooltip label="Favorites" aria-label="Favorites Tooltip">
                  <IconButton
                    aria-label="Favorites"
                    icon={
                      isQuestionAvailable && favorites.has(displayedQuestion.id) ? (
                        <StarFilledIcon style={{ width: '20px', height: '20px' }} />
                      ) : (
                        <StarIcon style={{ width: '20px', height: '20px' }} />
                      )
                    }
                    onClick={() =>
                      isQuestionAvailable && handleToggleFavorites(displayedQuestion.id)
                    }
                    backgroundColor="transparent"
                    _hover={{ backgroundColor: iconHoverBg }}
                  />
                </Tooltip>

                {/* Shuffle Button */}
                <Tooltip label="Shuffle" aria-label="Shuffle Tooltip">
                  <IconButton
                    aria-label="Shuffle"
                    icon={<ShuffleIcon style={{ width: '20px', height: '20px' }} />}
                    onClick={onConfirmationModalOpen}
                    backgroundColor="transparent"
                    _hover={{ backgroundColor: iconHoverBg }}
                  />
                </Tooltip>

                {/* Search Button */}
                <Tooltip label="Search" aria-label="Search Tooltip">
                  <IconButton
                    aria-label="Search"
                    icon={<MagnifyingGlassIcon style={{ width: '23px', height: '23px' }} />}
                    onClick={onSearchModalOpen}
                    backgroundColor="transparent"
                    _hover={{ backgroundColor: iconHoverBg }}
                  />
                </Tooltip>

                {/* Theme Toggle Button */}
                <IconButton
                  icon={
                    colorMode === 'dark' ? (
                      <SunIcon style={{ width: '20px', height: '20px' }} />
                    ) : (
                      <MoonIcon style={{ width: '20px', height: '20px' }} />
                    )
                  }
                  onClick={toggleColorMode}
                  aria-label={'Toggle Dark Mode'}
                  backgroundColor={iconBg}
                  _hover={{ backgroundColor: iconHoverBg }}
                />
              </Flex>
            )}
          </Flex>
        </Flex>

        {/* Question Card */}
        <QuestionDisplay
          question={displayedQuestion}
          onOptionSelect={handleOptionSelect}
          selectedOption={displayedQuestion.userSelectedOption}
          cardBgColor={cardBgColor}
          cardTextColor={cardTextColor}
          unselectedOptionBg={colorMode === 'dark' ? 'gray.600' : 'white'}
          quizSetId={id as string} // Pass quizSetId here
        />

        {/* Conditional rendering for Flip Card and Additional Info */}
        {showFlipCard && (
          <>
            {/* Flip Card with Navigation Arrows */}
            <Flex
              justify="center"
              alignItems="center"
              my={4}
              gap={2}
              direction="row"
              wrap={useBreakpointValue({ base: 'wrap', md: 'nowrap' })} // Allow wrapping on small screens
            >
              {/* Previous Button */}
              <IconButton
                aria-label="Previous"
                icon={<ArrowLeftIcon />}
                onClick={() => handleNavigate('prev')}
                backgroundColor="transparent"
                _hover={{
                  backgroundColor: iconHoverBg,
                  borderRadius: 'full',
                  borderColor: 'transparent',
                }}
                isRound
                size={useBreakpointValue({ base: 'sm', md: 'md' })}
                flexShrink={0} // Allow arrow to shrink
              />

              {/* Flip Card */}
              <Box flex="1" maxWidth="300px">
                <FlipCard
                  isFlipped={isCardFlipped}
                  onClick={handleFlipCard}
                  frontContent={
                    <Box p={4} textAlign="center">
                      Click to reveal answer
                    </Box>
                  }
                  backContent={
                    <Box p={4} textAlign="center">
                      Answer: {displayedQuestion.answer}
                    </Box>
                  }
                  bgColor={cardBgColor}
                />
              </Box>

              {/* Next Button */}
              <IconButton
                aria-label="Next"
                icon={<ArrowRightIcon />}
                onClick={() => handleNavigate('next')}
                backgroundColor="transparent"
                _hover={{
                  backgroundColor: iconHoverBg,
                  borderRadius: 'full',
                  borderColor: 'transparent',
                }}
                isRound
                size={useBreakpointValue({ base: 'sm', md: 'md' })}
                flexShrink={0} // Allow arrow to shrink
              />
            </Flex>

            {isCardFlipped && ( // Render Additional Info only if card is flipped
              <>
                <Divider my={4} />

                {/* Additional Info */}
                <AdditionalInfo
                  url={safeUrl}
                  explanation={safeExplanation}
                  discussion_link={displayedQuestion.discussion_link} // Pass actual discussion link
                  question_id={displayedQuestion.id}
                  questionDetails={{
                    question_text: displayedQuestion.question,
                    options: displayedQuestion.options,
                    answer: displayedQuestion.answer,
                  }}
                  quizSetId={id as string} // Pass quizSetId here
                />

                <Divider my={4} />
              </>
            )}
          </>
        )}

        <SearchModal
          isOpen={isSearchModalOpen}
          onClose={onSearchModalClose}
          searchKeyword={searchKeyword}
          onSearchChange={handleSearchChange}
          questions={questions}
          onNavigateToQuestion={onNavigateToQuestion}
          favorites={favorites}
          currentFilter={selectedFilter}
          getQuestionIndex={(questionId) => getQuestionIndex(questionId, selectedFilter)}
        />

        <UnansweredQuestionsModal
            isOpen={isUnansweredQuestionsModalOpen}
            onClose={() => setIsUnansweredQuestionsModalOpen(false)}
            unansweredQuestions={unansweredQuestions}
            navigateToQuestion={onNavigateToQuestion}
            favorites={favorites}
            setSelectedFilter={setSelectedFilter}
            onSubmitWithUnanswered={onSubmitWithUnanswered}
            currentFilter={selectedFilter}
            getQuestionIndex={(questionId) => getQuestionIndex(questionId, selectedFilter)}
        />

        <SummaryModal
            isOpen={isSummaryModalOpen}
            onClose={() => setIsSummaryModalOpen(false)}
            score={score}
            totalQuestions={questions.length}
            navigateToIncorrect={() => navigateToIncorrect(onNavigateToQuestion)}
            incorrectQuestionsCount={questions.filter(q => q.userSelectedOption !== q.answer).length}
        />

        {/* Confirmation Modal */}
        <ConfirmationModal 
            isOpen={isConfirmationModalOpen} 
            onClose={onConfirmationModalClose} 
            onConfirm={confirmShuffleQuestions}
        />

        {/* Reset Questions Modal */}
        <ResetModal
          isOpen={isResetModalOpen}
          onClose={onResetModalClose}
          onReset={handleReset}
        />
      </Box>
    </LoadingLayout>
  );  
}

export default QuizModePage;