# scraping_helpers.py

import requests
from bs4 import BeautifulSoup, Tag
from urllib.parse import urljoin
import os
import re
from random import choice
import time
from app_init import db
from models import Question
import config
from config import img_type_directory
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Helper functions
def download_image(img_url, path, name):
    # Construct the full path for the image
    full_path = os.path.join('../frontend/public/assets/images/background', path)

    # Log the full path for debugging
    print(f"Attempting to save image to: {os.path.join(full_path, name)}")
    print(f"Image URL: {img_url}")

    # Ensure the directory exists
    if not os.path.exists(full_path):
        print(f"Creating directory: {full_path}")
        os.makedirs(full_path)

    # Try to download the image
    try:
        response = requests.get(img_url, stream=True, verify=False)
        if response.status_code == 200:
            with open(os.path.join(full_path, name), 'wb') as out_file:
                out_file.write(response.content)
            print(f"Image successfully downloaded from: {img_url}")
            return True
        else:
            print(f"Failed to download image: {img_url} - HTTP Status Code: {response.status_code}")
            return False
    except Exception as e:
        print(f"Exception occurred during image download: {e}")
        return False

def fetch_discussion_comments(discussion_link):
    comments = []
    # Split the URL at the last dash before "#comments"
    base_url = discussion_link.split("#")[0]
    page_number = 1

    while True:
        if page_number == 1:
            page_url = discussion_link  # Use original link for the first page
        else:
            # Correctly construct the URL for subsequent pages
            page_url = f"{base_url}-{page_number}#comments"

        print(f"Fetching comments from URL: {page_url}")

        response = requests.get(page_url, headers={'User-Agent': choice(config.headers_list)}, verify=False)

        if response.status_code != 200:
            print(f"Failed to fetch page: {page_url}")
            break

        soup = BeautifulSoup(response.content, 'html.parser')

        # Determine the total number of pages from the first page
        if page_number == 1:
            discussion_info = soup.find('div', class_='left-box').get_text(strip=True)
            if "Page" in discussion_info:
                total_pages = int(discussion_info.split('Page')[1].split('of')[1].split('.')[0].strip())
            else:
                total_pages = 1
            print(f"Total number of discussion pages: {total_pages}")

        comment_divs = soup.find_all('div', class_='bix-sun-discussion')
        print(f"Found {len(comment_divs)} comment divs on page {page_number}")

        for div in comment_divs:
            user_details = div.find('div', class_='user-details')
            user_content = div.find('div', class_='user-content')
            if user_details and user_content:
                # Extract inner HTML content directly
                comment_inner_html = ''.join(str(child) for child in user_content.contents)
                comment_text = f"{user_details.get_text(strip=True)}: {comment_inner_html}"
                comments.append(comment_text)
                print(f"Extracted comment: {comment_text}")
            else:
                print("No user details or content found in this div")

        page_number += 1
        if page_number > total_pages:
            break

    if not comments:
        print("No comments were extracted")
    return '\n'.join(comments)

def process_question(base_url, url_number, question_counter, quiz_set_id):
    # Check if URL starts with https://
    if not base_url.startswith('https://'):
        base_url = 'https://' + base_url
    url = base_url + str(url_number).zfill(6)  # Format the URL number to ensure it's padded with zeros if necessary
    MAX_RETRIES = 10
    backoff_time = 3  # Time to wait before retrying in case of failure

    # Retry mechanism for robust scraping
    for attempt in range(MAX_RETRIES):
        try:
            time.sleep(backoff_time * attempt)  # Exponential backoff between retries
            # Fetch the page content
            page = requests.get(url, headers={'User-Agent': choice(config.headers_list)}, verify=False)
            page.raise_for_status()  # Ensure the request was successful
            break  # Exit loop if the request is successful
        except requests.RequestException as request_exception:
            print(f'Error occurred for {url}, waiting for {backoff_time * attempt} seconds before retrying...')
            if attempt == MAX_RETRIES - 1:  # If we've reached the maximum number of retries
                print(f"Failed to fetch {url} after {MAX_RETRIES} attempts. Error: {request_exception}")
                return question_counter  # Return the current counter if it fails
            continue  # Continue retrying
        except Exception as err:
            print(f"An unexpected error occurred: {err}")
            return question_counter  # Return the current question counter in case of any other errors

    soup = BeautifulSoup(page.content, 'html.parser')  # Parse the HTML content of the page
    questions = soup.find_all('div', class_='bix-div-container')  # Find all the question containers

    for question in questions:
        try:
            # Initialize a dictionary to store the processed question data
            question_dict = {}

            # Extract the question text
            q_text_elem = question.find('div', class_='bix-td-qtxt')
            question_text = str(q_text_elem).strip() if q_text_elem else 'Question not found.'

            # Extract options and the answer
            options_elems = question.find_all('div', class_='bix-td-option-val')
            answer_elem = question.find('input', class_='jq-hdnakq')
            answer = answer_elem['value'].upper() if answer_elem else 'Answer not found.'

            # Validate the answer
            if answer not in ['A', 'B', 'C', 'D']:
                raise ValueError('Invalid answer format.')

            answer = f"Option {answer}" if answer != 'Answer not found.' else answer

            # Handle explanation and discussion link
            explanation_elem = question.find('div', class_='bix-ans-description')
            discussion_link_elem = question.find('a', class_='discuss')
            explanation = str(explanation_elem).strip() if explanation_elem else 'Explanation not found.'
            discussion_link = discussion_link_elem['href'] if discussion_link_elem else 'Discussion link not found.'

            # Image handling logic
            img_count = {'within': 1, 'after': 1, 'explanation': 1}
            img_elems = q_text_elem.find_all('img') if q_text_elem else []

            # Process images within the question text
            for img_elem in img_elems:
                img_url = urljoin(url, img_elem['src'])
                img_data = str(img_elem.previous) if img_elem.previous else ""
                img_data = re.sub(r'\s+', '', img_data)

                # Determine if the image is 'within' or 'after' based on HTML structure
                name_type = 'after' if '<br/>' in img_data else 'within'
                placeholder = f'(image)q{question_counter}_{quiz_set_id}_{name_type}_{img_count[name_type]}(image)'  # Include quiz_set_id in image name
                question_text = question_text.replace(str(img_elem), placeholder)

                # Define the name and folder path for the image
                name = f'q{question_counter}_{quiz_set_id}_{name_type}_{img_count[name_type]}.png'
                folder_path = img_type_directory[name_type]

                # Download the image
                download_image(img_url, folder_path, name)
                img_count[name_type] += 1

            # Process explanation images, if present
            if explanation_elem:
                img_elems = explanation_elem.find_all('img')
                for img_elem in img_elems:
                    img_url = urljoin(url, img_elem['src'])
                    name = f'q{question_counter}_{quiz_set_id}_explanation_{img_count["explanation"]}.png'
                    folder_path = img_type_directory['explanation']

                    placeholder = f'(image)q{question_counter}_{quiz_set_id}_explanation_{img_count["explanation"]}(image)'
                    explanation = explanation.replace(str(img_elem), placeholder)

                    # Download explanation image
                    download_image(img_url, folder_path, name)
                    img_count["explanation"] += 1

            # Process options and their images
            options_processed = []
            for i, option_elem in enumerate(options_elems):
                flex_wrap_div = option_elem.find('div', class_='flex-wrap')
                if flex_wrap_div:
                    # Handle images in the options
                    img_options = flex_wrap_div.find_all('img')
                    option_img_count = 1

                    for img_option in img_options:
                        img_url = urljoin(url, img_option['src'])
                        option_name = chr(ord('A') + i)  # Option A, B, C, etc.
                        name = f'q{question_counter}_{quiz_set_id}_option{option_name}_{option_img_count}.png'
                        folder_path = img_type_directory["option"]

                        placeholder = f'<img src="/assets/images/background/Option/{name}" alt="{name}" style="display: inline-block; width: auto; height: auto;">'
                        flex_wrap_div = BeautifulSoup(flex_wrap_div.decode().replace(str(img_option), placeholder), 'html.parser')

                        # Download option image
                        download_image(img_url, folder_path, name)
                        option_img_count += 1

                    option_text = flex_wrap_div.decode_contents().strip()  # Processed option text
                else:
                    option_text = option_elem.text.strip()  # Plain text option

                # Process each option text to replace <span class="root"> tags
                root_span_in_option = re.search('<span class="root">(.*?)</span>', option_text)
                if root_span_in_option:
                    option_text = re.sub(root_span_in_option.group(), f'√({root_span_in_option.group(1).strip()})', option_text)

                options_processed.append(option_text)  # Add the processed option to the list

            # Fetch and process discussion comments if the link is valid
            if discussion_link != 'Discussion link not found.':
                discussion_comments = fetch_discussion_comments(discussion_link)
                question_dict['discussion_comments'] = discussion_comments
            else:
                question_dict['discussion_comments'] = ''

            # Log the processed question details
            print(f"Processed Question {question_counter}:")
            print(f"Text: {question_text}")
            print("Options: \n{}".format('\n'.join(options_processed)))
            print(f"Answer: {answer}")
            print(f"URL: {url}")
            print(f"Explanation: {explanation}")
            print(f"Discussion Link: {discussion_link}")
            print(f"Image Placeholder: {placeholder if img_elems else 'No Image'}")
            print("----------------------------------------------------")

            # Prepare the question dictionary to store in the database
            question_dict = {
                'text': question_text,
                'options': options_processed,
                'answer': answer,
                'url': url,
                'explanation': explanation,
                'discussion_link': discussion_link,
                'discussion_comments': question_dict.get('discussion_comments', '')
            }

            # Store the question in the database
            new_question = Question(
                text=question_dict['text'],
                options=question_dict['options'],
                answer=question_dict['answer'],
                url=question_dict['url'],
                explanation=question_dict['explanation'],
                discussion_link=question_dict['discussion_link'],
                discussion_comments=question_dict.get('discussion_comments', ''),
                quiz_set_id=quiz_set_id,
                order=question_counter  # Set the order field
            )
            db.session.add(new_question)

            # Increment the global question counter
            question_counter += 1

        except Exception as e:
            print(f"Error occurred while processing question: {e}")

    # Commit changes to the database
    db.session.commit()

    # Return the updated question counter
    return question_counter

def process_pinoybix_question(url, question_counter, quiz_set_id, db, Question):
    # Ensure the URL starts with https://
    if not url.startswith('https://'):
        url = 'https://' + url

    MAX_RETRIES = 10
    backoff_time = 3

    for attempt in range(MAX_RETRIES):
        try:
            time.sleep(backoff_time * attempt)
            # Send the HTTP request to get the content of the Pinoybix page
            response = requests.get(url, headers={'User-Agent': choice(config.headers_list)}, verify=False)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')

            folder_path = 'PinoybixAfter'
            if not os.path.exists(f'assets/images/background/{folder_path}'):
                os.makedirs(f'assets/images/background/{folder_path}')

            # Iterate over all paragraphs and look for the question pattern
            paragraphs = soup.find_all('p')
            for p in paragraphs:
                # Skip instructional text
                if 'Choose the letter of the best answer in each questions.' in p.get_text():
                    continue

                # Look for the question pattern (e.g., "1.")
                que_match = re.match(r'^(\d+)\.', p.text)
                if que_match:
                    # Ignore the question number from the webpage
                    # Use your own question_counter

                    question_html = str(p)
                    question_html = re.sub(r'^<p>\d+\.', '<p>', question_html)  # Remove question number from HTML

                    soup_question = BeautifulSoup(question_html, 'html.parser')
                    for img_tag in soup_question.find_all(['img', 'a']):
                        img_tag.decompose()  # Remove any image or link tags in the question
                    question_text = str(soup_question)

                    choices = []
                    key_answer = ''
                    placeholder = 'No Image'

                    # Look for an image in the current or next paragraph
                    img_tag = p.find('img')
                    if not img_tag:
                        next_p = p.find_next_sibling('p')
                        img_tag = next_p.find('img') if next_p else None

                    if img_tag and 'src' in img_tag.attrs:
                        img_url = img_tag['src']
                        # Use your own question_counter in the image filename
                        name = f'pinoybix_q{question_counter}_{quiz_set_id}_after_1.png'
                        download_success = download_image(img_url, folder_path, name)
                        if download_success:
                            placeholder = f'<br/>(image)pinoybix_q{question_counter}_{quiz_set_id}_after_1(image)'
                            question_text += placeholder

                    # Process the choices and find the answer
                    next_p = p.find_next_sibling()
                    while next_p:
                        if next_p.name == 'p':
                            if not next_p.text.startswith("View Answer:") and not next_p.text.startswith("Solution:"):
                                choice_match = re.match(r'^[A-Da-d][\).]', next_p.text)
                                if choice_match:
                                    choice_html = str(next_p)
                                    choice_html = re.sub(r'^<p>[A-Da-d][\).]\s*', '<p>', choice_html)
                                    choices.append(choice_html)
                                elif 'Answer:' in next_p.text:
                                    answer_match = re.search(r'Option ([A-D])', next_p.text)
                                    if answer_match:
                                        key_answer = 'Option ' + answer_match.group(1)
                                    break
                        elif next_p.name == 'div' and 'wp_shortcodes_toggle' in next_p.get('class', []):
                            # Look for the answer in a toggle section if available
                            answer_div = next_p.find('div', class_='togglec clearfix')
                            if answer_div:
                                answer_match = re.search(r'Option ([A-D])', answer_div.get_text())
                                if answer_match:
                                    key_answer = 'Option ' + answer_match.group(1)
                            break
                        next_p = next_p.find_next_sibling()

                    # Log the processed question details for debugging
                    print(f"Processed Question {question_counter}:")
                    print(f"Text: {question_text}")
                    print(f"Options: {choices}")
                    print(f"Answer: {key_answer}")
                    print(f"Image Placeholder: {placeholder}")
                    print("----------------------------------------------------")

                    # Create a new question entry and add it to the database
                    new_question = Question(
                        text=question_text,
                        options=choices,
                        answer=key_answer,
                        quiz_set_id=quiz_set_id,
                        url=url,
                        explanation="No explanation available",
                        discussion_link="No discussion link available",
                        order=question_counter  # Set the order field
                    )
                    db.session.add(new_question)
                    question_counter += 1  # Increment the global counter here

            # Commit the changes to the database
            db.session.commit()
            return question_counter  # Return the updated question_counter

        except requests.RequestException as request_exception:
            print(f'Error occurred for {url}, waiting for {backoff_time * attempt} secs before retrying.....')
            if attempt == MAX_RETRIES - 1:
                print(f"Error fetching {url} after {MAX_RETRIES} attempts, Error: {request_exception}")
                return question_counter  # Return the current question_counter even on failure
            continue
        except Exception as err:
            print(f'An error occurred: {err}')
            return question_counter  # Return the current question_counter in case of any other errors

def process_examveda_question(base_url, start_page, end_page, question_counter, quiz_set_id, db, Question):
    if not base_url.startswith('https://'):
        base_url = 'https://' + base_url

    MAX_RETRIES = 10
    backoff_time = 3

    # Process each page in the specified range (start_page to end_page)
    for page_num in range(int(start_page), int(end_page) + 1):
        url = f"{base_url}?page={page_num}"  # Adjust URL to include the page number

        for attempt in range(MAX_RETRIES):
            try:
                time.sleep(backoff_time * attempt)
                response = requests.get(url, headers={'User-Agent': choice(config.headers_list)}, verify=False)
                response.raise_for_status()

                soup = BeautifulSoup(response.content, 'html.parser')
                questions = soup.find_all('article', class_='question')

                # Ensure that questions are processed in the same order they appear on the page
                for question in questions:
                    q_text_elem = question.find('div', class_='question-main')
                    if not q_text_elem:
                        continue

                    question_html = str(q_text_elem)
                    question_html = re.sub(r'\$\s+', r'$ ', question_html)  # Handle special characters
                    question_html = re.sub(r'\$\$(.*?)\$\$', r'<span class="mathjax">\1</span>', question_html)
                    img_elems = q_text_elem.find_all('img')

                    # Handle main question images
                    for img_elem in img_elems:
                        img_url = urljoin(url, img_elem['src'])
                        img_extension = os.path.splitext(img_url)[1]
                        placeholder = f'(image)examveda_q{question_counter}_{quiz_set_id}_main(image)'
                        question_html = question_html.replace(str(img_elem), placeholder)

                        folder_path = 'ExamvedaMain'
                        # Correct path without public
                        if not os.path.exists(f'assets/images/background/{folder_path}'):
                            os.makedirs(f'assets/images/background/{folder_path}')

                        img_name = f'examveda_q{question_counter}_{quiz_set_id}_main{img_extension}'
                        download_image(img_url, folder_path, img_name)

                    # Extract options and explanation
                    options_html = []
                    option_blocks = question.find_all('p')
                    for block in option_blocks:
                        labels = block.find_all('label')
                        if len(labels) > 1:
                            option_html = str(labels[1])
                            options_html.append(option_html)

                    answer_elem = question.find('strong')
                    answer = answer_elem.text.strip() if answer_elem else 'Answer not found.'
                    explanation_elem = answer_elem.find_next_sibling('div') if answer_elem else None
                    explanation = explanation_elem.get_text(strip=True) if explanation_elem else 'No explanation available.'

                    discussion_link_elem = question.find('a', text='Discuss in Board')
                    discussion_link = discussion_link_elem['href'] if discussion_link_elem else 'Discussion link not found.'

                    # Log processed question details
                    print(f"Processed Question {question_counter}:")
                    print(f"Text: {question_html}")
                    print(f"Options: \n{options_html}")
                    print(f"Answer: {answer}")
                    print(f"URL: {url}")
                    print(f"Explanation: {explanation}")
                    print(f"Discussion Link: {discussion_link}")
                    print("----------------------------------------------------")

                    # Store question in the database
                    new_question = Question(
                        text=question_html,
                        options=options_html,
                        answer=answer,
                        explanation=explanation,
                        url=url,
                        discussion_link=discussion_link,
                        quiz_set_id=quiz_set_id,
                        order=question_counter  # Set the order field
                    )
                    db.session.add(new_question)

                    question_counter += 1  # Ensure the question counter increments sequentially

                db.session.commit()  # Commit after processing each page
                break  # Break retry loop if successful

            except requests.RequestException as request_exception:
                print(f'Error occurred for {url}, waiting for {backoff_time * attempt} secs before retrying...')
                if attempt == MAX_RETRIES - 1:
                    print(f"Error fetching {url} after {MAX_RETRIES} attempts, Error: {request_exception}")
                continue
            except Exception as e:
                print(f"Error occurred while processing page {page_num}: {e}")
                break

    return question_counter  # Return the updated question counter

def process_examprimer_question(url, question_counter, quiz_set_id, db, Question):
    if not url.startswith('https://'):
        url = 'https://' + url

    MAX_RETRIES = 10
    backoff_time = 3
    driver = None  # Declare driver outside the try block

    for attempt in range(MAX_RETRIES):
        try:
            time.sleep(backoff_time * attempt)
            options = Options()
            options.add_argument("--headless")  # Enable headless mode
            options.add_argument("start-maximized")  # Start maximized for better performance in headless mode

            driver = webdriver.Chrome(options=options)
            driver.get(url)

            WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID, "butCheck")))
            check_answers_button = driver.find_element(By.ID, "butCheck")
            check_answers_button.click()

            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CLASS_NAME, "question")))
            questions = driver.find_elements(By.CLASS_NAME, "question")

            for question in questions:
                full_text = question.text.strip()
                lines = full_text.split('\n')
                question_text = '\n'.join(lines[1:-4]).strip()
                options = lines[-4:]

                options_elements = question.find_elements(By.CLASS_NAME, "answer")
                correct_answer_index = None

                for i, option_element in enumerate(options_elements):
                    if "lightgreen" in option_element.get_attribute("style"):
                        correct_answer_index = i
                        break

                correct_option = 'Option ' + chr(correct_answer_index + 65) if correct_answer_index is not None else "No correct answer found"

                # Print details instead of writing to a file
                print(f"Processed Question {question_counter}:")
                print(f"Text: {question_text}")
                print("Options: \n{}".format('\n'.join(options)))
                print(f"Answer: {correct_option}")
                print(f"URL: {url}")
                print("Explanation: No explanation available.")
                print("Discussion Link: Discussion link not found.")
                print("----------------------------------------------------")

                # Create a new Question object and add it to the session
                new_question = Question(
                    text=question_text,
                    options=options,
                    answer=correct_option,
                    explanation="No explanation available",
                    url=url,
                    discussion_link="Discussion link not found.",
                    quiz_set_id=quiz_set_id
                )
                db.session.add(new_question)
                question_counter += 1

        except requests.RequestException as request_exception:
            print(f'Error occurred for {url}, waiting for {backoff_time * attempt} secs before retrying.....')
            if attempt == MAX_RETRIES - 1:
                print(f"Error fetching {url} after {MAX_RETRIES} attempts, Error: {request_exception}")
        except Exception as e:
            print(f'An unexpected error occurred: {e}')
        finally:
            if driver:
                driver.quit()  # Quit the driver if it's initialized

        if attempt == MAX_RETRIES - 1:
            return question_counter  # Return from the function if all retries fail

    return question_counter